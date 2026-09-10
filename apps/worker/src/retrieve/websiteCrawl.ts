import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, ErrorCode, websiteCrawlDefaults } from "@ai-archaeologist/shared";
import { assertPublicWebsiteUrl } from "./assertPublicWebsiteUrl.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES_PER_ASSET = 1_500_000;
const MAX_BYTES_PER_PAGE = 1_500_000;
const MAX_REDIRECTS = 5;
const MAX_ROBOTS_BYTES = 200_000;
const USER_AGENT = "ArchiAI-Public-Site-Assessment/1.0 (+https://archi-ai.example/assessment-policy)";

type FetchedResource = {
  body: Buffer;
  contentType: string;
  finalUrl: string;
  headers: Record<string, string>;
  setCookies: string[];
  status: number;
  truncated: boolean;
};

type CrawlCandidate = { depth: number; discoveredFrom: string; url: string };

type FormProfile = {
  action: string;
  fieldCount: number;
  hasFileInput: boolean;
  hasPasswordInput: boolean;
  method: string;
};

type ResourceReference = {
  integrity: boolean;
  kind: "script" | "stylesheet";
  path?: string;
  thirdParty: boolean;
  url: string;
};

type CapturedPage = {
  contentType: string;
  cookies: Array<Record<string, boolean | string>>;
  depth: number;
  description?: string;
  discoveredFrom?: string;
  externalLinkCount: number;
  forms: FormProfile[];
  links: string[];
  path: string;
  resources: ResourceReference[];
  securityHeaders: Record<string, string>;
  status: number;
  targetBlankWithoutNoopener: number;
  title: string;
  truncated: boolean;
  url: string;
};

type RobotsPolicy = { allowed: boolean; ruleCount: number; status?: number; url: string };
type RobotsRule = { allowed: boolean; path: string };

export type WebsiteCrawlOptions = {
  maxAssets?: number;
  maxDepth?: number;
  maxPages?: number;
  requestDelayMs?: number;
};

export type WebsiteCrawlResult = {
  discoveredCount: number;
  failedCount: number;
  maxDepth: number;
  maxPages: number;
  pageCount: number;
  robotsHonored: boolean;
  skippedCount: number;
  startUrl: string;
};

/**
 * Passively inventories public pages linked from the supplied origin. It never
 * authenticates, retains browser state, submits forms, executes JavaScript,
 * guesses routes, or sends vulnerability payloads.
 */
export async function crawlPublicWebsite(
  startUrl: string,
  targetDirectory: string,
  requestedOptions: WebsiteCrawlOptions = {},
): Promise<WebsiteCrawlResult> {
  const options = normalizeOptions(requestedOptions);
  await mkdir(targetDirectory, { recursive: true });

  const homepage = await fetchResource(startUrl, { maxBytes: MAX_BYTES_PER_PAGE });
  if (homepage.status >= 400) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: `Website returned HTTP ${homepage.status}. The host may block automated analysis.`,
      statusCode: 400,
    });
  }
  if (!isHtmlResponse(homepage.contentType)) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "The submitted URL did not return an HTML page.",
      statusCode: 400,
    });
  }

  const scopeOrigin = new URL(homepage.finalUrl).origin;
  const canonicalStartUrl = canonicalizeUrl(homepage.finalUrl);
  const robots = await loadRobotsPolicy(scopeOrigin);
  const pages: CapturedPage[] = [];
  const skipped: Array<{ reason: string; url: string }> = [];
  const failed: Array<{ reason: string; url: string }> = [];
  const visitedUrls = new Set<string>([canonicalStartUrl]);
  const queuedUrls = new Set<string>();
  const discoveryQueue: CrawlCandidate[] = [];

  const firstPage = buildPageRecord({
    depth: 0,
    page: homepage,
    pagePath: "pages/index.html",
    scopeOrigin,
  });
  pages.push(firstPage);
  await writeBinary(path.join(targetDirectory, firstPage.path), homepage.body);
  enqueueLinks(firstPage, discoveryQueue, queuedUrls, visitedUrls, options.maxDepth, skipped);

  while (discoveryQueue.length > 0 && pages.length < options.maxPages) {
    const candidate = discoveryQueue.shift();
    if (!candidate) continue;
    queuedUrls.delete(candidate.url);

    const pathname = new URL(candidate.url).pathname;
    if (!isAllowedByRobots(pathname, robots)) {
      skipped.push({ reason: "robots.txt disallow", url: candidate.url });
      continue;
    }
    if (isPotentiallyStateChangingPath(pathname)) {
      skipped.push({ reason: "state-changing navigation path", url: candidate.url });
      continue;
    }

    await wait(options.requestDelayMs);
    try {
      const page = await fetchResource(candidate.url, {
        allowedOrigin: scopeOrigin,
        maxBytes: MAX_BYTES_PER_PAGE,
      });
      const canonicalFinalUrl = canonicalizeUrl(page.finalUrl);
      if (visitedUrls.has(canonicalFinalUrl)) continue;
      visitedUrls.add(canonicalFinalUrl);

      if (page.status >= 400) {
        failed.push({ reason: `HTTP ${page.status}`, url: canonicalFinalUrl });
        continue;
      }
      if (!isHtmlResponse(page.contentType)) {
        skipped.push({ reason: "non-HTML response", url: canonicalFinalUrl });
        continue;
      }

      const pagePath = `pages/page-${String(pages.length).padStart(3, "0")}.html`;
      const captured = buildPageRecord({
        depth: candidate.depth,
        discoveredFrom: candidate.discoveredFrom,
        page,
        pagePath,
        scopeOrigin,
      });
      pages.push(captured);
      await writeBinary(path.join(targetDirectory, captured.path), page.body);
      enqueueLinks(captured, discoveryQueue, queuedUrls, visitedUrls, options.maxDepth, skipped);
    } catch (error) {
      failed.push({ reason: safeErrorMessage(error), url: candidate.url });
    }
  }

  if (discoveryQueue.length > 0) {
    for (const candidate of discoveryQueue.slice(0, 50)) {
      skipped.push({ reason: "page budget reached", url: candidate.url });
    }
  }

  const assets = await captureSameOriginAssets({ options, pages, scopeOrigin, targetDirectory });
  const rootSecurityHeaders = pages[0]?.securityHeaders ?? {};
  const rootCookies = pages[0]?.cookies ?? [];
  const siteProfile = {
    assets,
    crawl: {
      discoveredCount: visitedUrls.size + discoveryQueue.length,
      failedCount: failed.length,
      maxDepth: options.maxDepth,
      maxPages: options.maxPages,
      requestDelayMs: options.requestDelayMs,
      skippedCount: skipped.length,
    },
    cookies: rootCookies,
    pages,
    robots: robots.policy,
    scopeOrigin,
    securityHeaders: rootSecurityHeaders,
    startUrl: canonicalStartUrl,
    thirdParties: collectThirdParties(scopeOrigin, pages),
    title: firstPage.title,
    version: 2,
  };

  await writeBinary(
    path.join(targetDirectory, "_archaeologist", "site-profile.json"),
    Buffer.from(JSON.stringify(siteProfile, null, 2), "utf8"),
  );
  await writeBinary(
    path.join(targetDirectory, "_archaeologist", "security-headers.json"),
    Buffer.from(JSON.stringify(rootSecurityHeaders, null, 2), "utf8"),
  );
  await writeBinary(
    path.join(targetDirectory, "_archaeologist", "crawl-observations.json"),
    Buffer.from(JSON.stringify({ failed: failed.slice(0, 100), skipped: skipped.slice(0, 100) }, null, 2), "utf8"),
  );
  await writeBinary(path.join(targetDirectory, "README.md"), Buffer.from(buildCrawlReadme(siteProfile), "utf8"));

  return {
    discoveredCount: siteProfile.crawl.discoveredCount,
    failedCount: failed.length,
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
    pageCount: pages.length,
    robotsHonored: robots.policy.allowed,
    skippedCount: skipped.length,
    startUrl: canonicalStartUrl,
  };
}

function normalizeOptions(requested: WebsiteCrawlOptions): Required<WebsiteCrawlOptions> {
  return {
    maxAssets: clamp(requested.maxAssets, 1, 100, websiteCrawlDefaults.maxAssets),
    maxDepth: clamp(requested.maxDepth, 0, 5, websiteCrawlDefaults.maxDepth),
    maxPages: clamp(requested.maxPages, 1, 100, websiteCrawlDefaults.maxPages),
    requestDelayMs: clamp(requested.requestDelayMs, 100, 5_000, websiteCrawlDefaults.requestDelayMs),
  };
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  return value === undefined || !Number.isFinite(value)
    ? fallback
    : Math.min(max, Math.max(min, Math.floor(value)));
}

function buildPageRecord(input: {
  depth: number;
  discoveredFrom?: string;
  page: FetchedResource;
  pagePath: string;
  scopeOrigin: string;
}): CapturedPage {
  const html = input.page.body.toString("utf8");
  const links = extractNavigableLinks(html, input.page.finalUrl, input.scopeOrigin);
  return {
    contentType: input.page.contentType,
    cookies: parseSetCookies(input.page.setCookies),
    depth: input.depth,
    ...(input.discoveredFrom ? { discoveredFrom: input.discoveredFrom } : {}),
    description: extractMeta(html, "description") ?? extractMeta(html, "og:description"),
    externalLinkCount: links.externalCount,
    forms: extractForms(html, input.page.finalUrl),
    links: links.internal,
    path: input.pagePath,
    resources: extractResourceReferences(html, input.page.finalUrl, input.scopeOrigin),
    securityHeaders: pickSecurityHeaders(input.page.headers),
    status: input.page.status,
    targetBlankWithoutNoopener: links.targetBlankWithoutNoopener,
    title: extractTagContent(html, "title") ?? new URL(input.page.finalUrl).hostname,
    truncated: input.page.truncated,
    url: canonicalizeUrl(input.page.finalUrl),
  };
}

function enqueueLinks(
  page: CapturedPage,
  queue: CrawlCandidate[],
  queuedUrls: Set<string>,
  visitedUrls: Set<string>,
  maxDepth: number,
  skipped: Array<{ reason: string; url: string }>,
): void {
  for (const link of page.links) {
    if (page.depth >= maxDepth) {
      skipped.push({ reason: "depth budget reached", url: link });
      continue;
    }
    if (visitedUrls.has(link) || queuedUrls.has(link)) continue;
    queuedUrls.add(link);
    queue.push({ depth: page.depth + 1, discoveredFrom: page.url, url: link });
  }
}

async function captureSameOriginAssets(input: {
  options: Required<WebsiteCrawlOptions>;
  pages: CapturedPage[];
  scopeOrigin: string;
  targetDirectory: string;
}): Promise<Array<{ kind: string; path: string; url: string }>> {
  const candidates = new Map<string, ResourceReference>();
  for (const page of input.pages) {
    for (const resource of page.resources) {
      if (!resource.thirdParty && !candidates.has(resource.url)) candidates.set(resource.url, resource);
    }
  }

  const storedPaths = new Map<string, string>();
  const assets: Array<{ kind: string; path: string; url: string }> = [];
  for (const resource of [...candidates.values()].slice(0, input.options.maxAssets)) {
    await wait(input.options.requestDelayMs);
    try {
      const asset = await fetchResource(resource.url, {
        allowedOrigin: input.scopeOrigin,
        maxBytes: MAX_BYTES_PER_ASSET,
      });
      if (asset.status >= 400 || asset.truncated) continue;
      const extension = extensionFromUrl(resource.url, asset.contentType);
      const digest = createHash("sha256").update(asset.body).digest("hex").slice(0, 12);
      const relativePath = `assets/${resource.kind}-${digest}${extension}`;
      await writeBinary(path.join(input.targetDirectory, relativePath), asset.body);
      storedPaths.set(resource.url, relativePath);
      assets.push({ kind: resource.kind, path: relativePath, url: canonicalizeUrl(asset.finalUrl) });
    } catch {
      // Capturing an asset is optional; the page record retains the reference.
    }
  }

  for (const page of input.pages) {
    for (const resource of page.resources) {
      const storedPath = storedPaths.get(resource.url);
      if (storedPath) resource.path = storedPath;
    }
  }
  return assets;
}

async function loadRobotsPolicy(scopeOrigin: string): Promise<{ policy: RobotsPolicy; rules: RobotsRule[] }> {
  const robotsUrl = new URL("/robots.txt", scopeOrigin).href;
  try {
    const response = await fetchResource(robotsUrl, { allowedOrigin: scopeOrigin, maxBytes: MAX_ROBOTS_BYTES });
    if (response.status >= 400 || response.truncated) {
      return { policy: { allowed: true, ruleCount: 0, status: response.status, url: robotsUrl }, rules: [] };
    }
    const rules = parseRobotsRules(response.body.toString("utf8"));
    return {
      policy: { allowed: true, ruleCount: rules.length, status: response.status, url: canonicalizeUrl(response.finalUrl) },
      rules,
    };
  } catch {
    return { policy: { allowed: true, ruleCount: 0, url: robotsUrl }, rules: [] };
  }
}

function parseRobotsRules(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let applies = false;
  let sawDirective = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (!line || separator < 1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (sawDirective) {
        applies = false;
        sawDirective = false;
      }
      if (value.toLowerCase() === "*" || value.toLowerCase().includes("archiai")) applies = true;
      continue;
    }
    if ((key === "allow" || key === "disallow") && applies && value) {
      rules.push({ allowed: key === "allow", path: value });
      sawDirective = true;
    }
  }
  return rules;
}

function isAllowedByRobots(pathname: string, robots: { rules: RobotsRule[] }): boolean {
  const matches = robots.rules.filter((rule) => pathname.startsWith(rule.path));
  if (matches.length === 0) return true;
  matches.sort((left, right) => right.path.length - left.path.length || Number(right.allowed) - Number(left.allowed));
  return matches[0]?.allowed ?? true;
}

async function fetchResource(
  inputUrl: string,
  options: { allowedOrigin?: string; maxBytes: number },
): Promise<FetchedResource> {
  let requestUrl = canonicalizeUrl(inputUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const parsed = await assertPublicWebsiteUrl(requestUrl);
    if (options.allowedOrigin && parsed.origin !== options.allowedOrigin) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: "Redirect left the approved website origin.",
        statusCode: 400,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(parsed.href, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/css,text/javascript,application/javascript;q=0.8,*/*;q=0.5",
          "User-Agent": USER_AGENT,
        },
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
      const location = response.headers.get("location");
      if (isRedirect(response.status) && location) {
        await response.body?.cancel();
        requestUrl = canonicalizeUrl(new URL(location, parsed.href).href);
        continue;
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
      const { body, truncated } = await readResponseBody(response, options.maxBytes);
      const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
      return {
        body,
        contentType: response.headers.get("content-type")?.toLowerCase() ?? "application/octet-stream",
        finalUrl: canonicalizeUrl(parsed.href),
        headers,
        setCookies: getSetCookie ? getSetCookie.call(response.headers) : splitSetCookie(headers["set-cookie"]),
        status: response.status,
        truncated,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: ErrorCode.ServiceUnavailable,
        message: error instanceof Error ? error.message.slice(0, 240) : "Website fetch failed.",
        statusCode: 502,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new AppError({
    code: ErrorCode.InvalidInput,
    message: `Website exceeded the ${MAX_REDIRECTS}-redirect limit.`,
    statusCode: 400,
  });
}

async function readResponseBody(response: Response, maxBytes: number): Promise<{ body: Buffer; truncated: boolean }> {
  if (!response.body) return { body: Buffer.alloc(0), truncated: false };
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return { body: Buffer.concat(chunks), truncated: false };
    const chunk = Buffer.from(value);
    if (total + chunk.length > maxBytes) {
      await reader.cancel();
      return { body: Buffer.concat(chunks), truncated: true };
    }
    chunks.push(chunk);
    total += chunk.length;
  }
}

function extractNavigableLinks(html: string, baseUrl: string, scopeOrigin: string): {
  externalCount: number;
  internal: string[];
  targetBlankWithoutNoopener: number;
} {
  const internal = new Set<string>();
  let externalCount = 0;
  let targetBlankWithoutNoopener = 0;
  for (const tag of html.matchAll(/<a\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(tag[0] ?? "");
    if (!attributes.href) continue;
    const resolved = resolveUrl(baseUrl, attributes.href);
    if (!resolved) continue;
    const parsed = new URL(resolved);
    if (attributes.target?.toLowerCase() === "_blank" && !/\bnoopener\b/i.test(attributes.rel ?? "")) {
      targetBlankWithoutNoopener += 1;
    }
    if (parsed.origin !== scopeOrigin) {
      externalCount += 1;
      continue;
    }
    internal.add(canonicalizeUrl(parsed.href));
  }
  return { externalCount, internal: [...internal].sort(), targetBlankWithoutNoopener };
}

function extractResourceReferences(html: string, baseUrl: string, scopeOrigin: string): ResourceReference[] {
  const resources: ResourceReference[] = [];
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(tag[0] ?? "");
    const url = attributes.src ? resolveUrl(baseUrl, attributes.src) : undefined;
    if (url) {
      resources.push({ integrity: Boolean(attributes.integrity), kind: "script", thirdParty: new URL(url).origin !== scopeOrigin, url: canonicalizeUrl(url) });
    }
  }
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(tag[0] ?? "");
    if (!/\bstylesheet\b/i.test(attributes.rel ?? "") || !attributes.href) continue;
    const url = resolveUrl(baseUrl, attributes.href);
    if (url) {
      resources.push({ integrity: Boolean(attributes.integrity), kind: "stylesheet", thirdParty: new URL(url).origin !== scopeOrigin, url: canonicalizeUrl(url) });
    }
  }
  return dedupeResources(resources);
}

function extractForms(html: string, baseUrl: string): FormProfile[] {
  const forms: FormProfile[] = [];
  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attributes = parseTagAttributes(match[1] ?? "");
    const inputs = [...(match[2] ?? "").matchAll(/<(?:input|textarea|select)\b[^>]*>/gi)];
    const inputTypes = inputs.map((input) => parseTagAttributes(input[0] ?? "").type?.toLowerCase() ?? "text");
    forms.push({
      action: canonicalizeUrl(resolveUrl(baseUrl, attributes.action ?? "") ?? baseUrl),
      fieldCount: inputs.length,
      hasFileInput: inputTypes.includes("file"),
      hasPasswordInput: inputTypes.includes("password"),
      method: (attributes.method ?? "get").toUpperCase(),
    });
  }
  return forms.slice(0, 20);
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key = match[1]?.toLowerCase();
    if (!key || ["a", "script", "link", "form", "input", "textarea", "select"].includes(key)) continue;
    attributes[key] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function extractTagContent(html: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function extractMeta(html: string, name: string): string | undefined {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i");
  return pattern.exec(html)?.[1]?.trim() ?? alt.exec(html)?.[1]?.trim();
}

function resolveUrl(baseUrl: string, value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /^(?:data|javascript|mailto|tel):/i.test(trimmed)) return undefined;
  try {
    const parsed = new URL(trimmed, baseUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function canonicalizeUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(?:utm_[\w-]+|fbclid|gclid|mc_[\w-]+)$/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return parsed.href;
}

function pickSecurityHeaders(headers: Record<string, string>): Record<string, string> {
  const keys = ["content-security-policy", "content-security-policy-report-only", "strict-transport-security", "x-content-type-options", "x-frame-options", "x-xss-protection", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "cross-origin-resource-policy"];
  return Object.fromEntries(keys.filter((key) => Boolean(headers[key])).map((key) => [key, headers[key] as string]));
}

function parseSetCookies(headers: string[]): Array<Record<string, boolean | string>> {
  return headers.slice(0, 20).map((header) => {
    const segments = header.split(";").map((item) => item.trim());
    const name = segments[0]?.split("=")[0] ?? "cookie";
    const flags = new Set(segments.slice(1).map((flag) => flag.toLowerCase().split("=")[0] ?? ""));
    return { httpOnly: flags.has("httponly"), name, secure: flags.has("secure"), sameSite: segments.find((flag) => flag.toLowerCase().startsWith("samesite=")) ?? "" };
  });
}

function splitSetCookie(header: string | undefined): string[] {
  return header ? header.split(/,(?=[^;,\s]+=)/) : [];
}

function collectThirdParties(scopeOrigin: string, pages: CapturedPage[]): string[] {
  const hosts = new Set<string>();
  for (const page of pages) {
    for (const resource of page.resources) {
      if (resource.thirdParty) hosts.add(new URL(resource.url).hostname.toLowerCase());
    }
    for (const form of page.forms) {
      if (new URL(form.action).origin !== scopeOrigin) hosts.add(new URL(form.action).hostname.toLowerCase());
    }
  }
  return [...hosts].sort();
}

function dedupeResources(resources: ResourceReference[]): ResourceReference[] {
  return [...new Map(resources.map((resource) => [`${resource.kind}:${resource.url}`, resource])).values()];
}

function extensionFromUrl(url: string, contentType: string): string {
  const pathname = new URL(url).pathname.toLowerCase();
  const extension = pathname.slice(pathname.lastIndexOf("."));
  if (extension && extension.length <= 8 && /^\.[a-z0-9]+$/.test(extension)) return extension;
  if (contentType.includes("javascript")) return ".js";
  if (contentType.includes("css")) return ".css";
  return ".bin";
}

function buildCrawlReadme(profile: {
  crawl: { maxDepth: number; maxPages: number };
  pages: CapturedPage[];
  scopeOrigin: string;
  startUrl: string;
  thirdParties: string[];
  title: string;
}): string {
  return [
    `# ${profile.title}`,
    "",
    `Captured from \`${profile.startUrl}\` within \`${profile.scopeOrigin}\`.`,
    "",
    "## Assessment scope",
    "",
    `- Public same-origin HTML pages, breadth-first, up to ${profile.crawl.maxPages} pages and depth ${profile.crawl.maxDepth}.`,
    "- robots.txt is honored; no authentication, JavaScript execution, form submission, route guessing, or exploit traffic occurs.",
    "",
    "## Captured pages",
    "",
    ...profile.pages.map((page) => `- [${page.url}](${page.path}) — depth ${page.depth}, HTTP ${page.status}`),
    "",
    "## Third-party resource and form hosts",
    "",
    ...(profile.thirdParties.length > 0 ? profile.thirdParties.map((host) => `- ${host}`) : ["- none observed"]),
    "",
  ].join("\n");
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isHtmlResponse(contentType: string): boolean {
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function isPotentiallyStateChangingPath(pathname: string): boolean {
  return /(?:^|\/)(?:logout|signout|delete|destroy|remove|unsubscribe)(?:\/|$)/i.test(pathname);
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 180) : "request failed";
}

async function writeBinary(filePath: string, body: Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => { setTimeout(resolve, milliseconds); });
}
