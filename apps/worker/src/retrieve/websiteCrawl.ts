import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { AppError, ErrorCode } from "@ai-archaeologist/shared";
import { assertPublicWebsiteUrl } from "./assertPublicWebsiteUrl.js";

const MAX_HTML_PAGES = 6;
const MAX_ASSETS = 12;
const MAX_BYTES_PER_FILE = 1_500_000;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

type FetchedResource = {
  body: Buffer;
  contentType: string;
  finalUrl: string;
  headers: Record<string, string>;
  status: number;
};

export type WebsiteCrawlResult = {
  pageCount: number;
  startUrl: string;
};

export async function crawlPublicWebsite(startUrl: string, targetDirectory: string): Promise<WebsiteCrawlResult> {
  const origin = await assertPublicWebsiteUrl(startUrl);
  await mkdir(targetDirectory, { recursive: true });

  const homepage = await fetchResource(origin.href);
  if (homepage.status >= 400) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: `Website returned HTTP ${homepage.status}. The host may block automated analysis.`,
      statusCode: 400,
    });
  }

  const html = homepage.body.toString("utf8");
  const title = extractTagContent(html, "title") ?? origin.hostname;
  const description =
    extractMeta(html, "description") ?? extractMeta(html, "og:description") ?? "";
  const generator = extractMeta(html, "generator");
  const sameOriginLinks = extractSameOriginLinks(html, homepage.finalUrl).slice(0, MAX_HTML_PAGES - 1);
  const scriptSrcs = extractAttributes(html, "script", "src");
  const stylesheets = extractStylesheetHrefs(html, homepage.finalUrl);
  const scripts = scriptSrcs
    .map((src) => resolveUrl(homepage.finalUrl, src))
    .filter((value): value is string => Boolean(value));

  const pages: Array<{ path: string; url: string; status: number }> = [];
  await writeBinary(path.join(targetDirectory, "pages", "index.html"), homepage.body);
  pages.push({ path: "pages/index.html", status: homepage.status, url: homepage.finalUrl });

  let pageIndex = 1;
  for (const link of sameOriginLinks) {
    if (pages.length >= MAX_HTML_PAGES) {
      break;
    }
    try {
      await assertPublicWebsiteUrl(link);
      const page = await fetchResource(link);
      if (page.status >= 400 || !page.contentType.includes("html")) {
        continue;
      }
      const fileName = `page-${pageIndex}.html`;
      await writeBinary(path.join(targetDirectory, "pages", fileName), page.body);
      pages.push({ path: `pages/${fileName}`, status: page.status, url: page.finalUrl });
      pageIndex += 1;
    } catch {
      continue;
    }
  }

  const assetRecords: Array<{ path: string; url: string; kind: string }> = [];
  const assetQueue = [
    ...scripts.slice(0, MAX_ASSETS).map((url) => ({ kind: "script", url })),
    ...stylesheets.slice(0, Math.max(0, MAX_ASSETS - scripts.length)).map((url) => ({
      kind: "stylesheet",
      url,
    })),
  ];

  for (const asset of assetQueue) {
    if (assetRecords.length >= MAX_ASSETS) {
      break;
    }
    try {
      await assertPublicWebsiteUrl(asset.url);
      const resource = await fetchResource(asset.url);
      if (resource.status >= 400) {
        continue;
      }
      const extension = extensionFromUrl(asset.url, resource.contentType);
      const digest = createHash("sha256").update(resource.body).digest("hex").slice(0, 12);
      const relativePath = `assets/${asset.kind}-${digest}${extension}`;
      await writeBinary(path.join(targetDirectory, relativePath), resource.body);
      assetRecords.push({ kind: asset.kind, path: relativePath, url: resource.finalUrl });
    } catch {
      continue;
    }
  }

  let robots = "";
  try {
    const robotsResponse = await fetchResource(new URL("/robots.txt", origin).href);
    if (robotsResponse.status < 400) {
      robots = robotsResponse.body.toString("utf8").slice(0, 20_000);
      await writeBinary(path.join(targetDirectory, "robots.txt"), Buffer.from(robots, "utf8"));
    }
  } catch {
    robots = "";
  }

  const securityHeaders = pickSecurityHeaders(homepage.headers);
  const thirdParties = collectThirdParties(origin.hostname, [...scripts, ...stylesheets]);
  const frameworks = detectFrameworks(html, scripts);
  const cookies = parseSetCookie(homepage.headers["set-cookie"] ?? "");

  const siteProfile = {
    cookies,
    description,
    frameworks,
    generator,
    pages,
    securityHeaders,
    startUrl: origin.href,
    thirdParties,
    title,
    assets: assetRecords,
  };

  await writeBinary(
    path.join(targetDirectory, "_archaeologist", "site-profile.json"),
    Buffer.from(JSON.stringify(siteProfile, null, 2), "utf8"),
  );
  await writeBinary(
    path.join(targetDirectory, "_archaeologist", "security-headers.json"),
    Buffer.from(JSON.stringify(securityHeaders, null, 2), "utf8"),
  );
  await writeBinary(
    path.join(targetDirectory, "README.md"),
    Buffer.from(buildCrawlReadme(siteProfile), "utf8"),
  );

  return { pageCount: pages.length, startUrl: origin.href };
}

async function fetchResource(url: string): Promise<FetchedResource> {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    const finalUrl = response.url;
    await assertPublicWebsiteUrl(finalUrl);

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const chunks: Buffer[] = [];
    let total = 0;
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = Buffer.from(value);
        total += chunk.length;
        if (total > MAX_BYTES_PER_FILE) {
          break;
        }
        chunks.push(chunk);
      }
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      body: Buffer.concat(chunks),
      contentType,
      finalUrl,
      headers,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError({
      code: ErrorCode.ServiceUnavailable,
      message: error instanceof Error ? error.message.slice(0, 240) : "Website fetch failed.",
      statusCode: 502,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function writeBinary(filePath: string, body: Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

function extractTagContent(html: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function extractMeta(html: string, name: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  return pattern.exec(html)?.[1]?.trim() ?? alt.exec(html)?.[1]?.trim();
}

function extractAttributes(html: string, tag: string, attribute: string): string[] {
  const values: string[] = [];
  const regex = new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "gi");
  for (const match of html.matchAll(regex)) {
    if (match[1]) {
      values.push(match[1]);
    }
  }
  return [...new Set(values)];
}
function extractStylesheetHrefs(html: string, baseUrl: string): string[] {
  const hrefs: string[] = [];
  const regex = /<link\b[^>]*>/gi;
  for (const match of html.matchAll(regex)) {
    const tag = match[0] ?? "";
    if (!/rel=["'][^"']*stylesheet/i.test(tag)) {
      continue;
    }
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    const resolved = href ? resolveUrl(baseUrl, href) : undefined;
    if (resolved) {
      hrefs.push(resolved);
    }
  }
  return [...new Set(hrefs)];
}

function extractSameOriginLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl);
  const links: string[] = [];
  for (const href of extractAttributes(html, "a", "href")) {
    const resolved = resolveUrl(baseUrl, href);
    if (!resolved) {
      continue;
    }
    try {
      const parsed = new URL(resolved);
      if (parsed.origin !== origin.origin) {
        continue;
      }
      parsed.hash = "";
      if (parsed.pathname === origin.pathname && parsed.search === origin.search) {
        continue;
      }
      links.push(parsed.href);
    } catch {
      continue;
    }
  }
  return [...new Set(links)];
}

function resolveUrl(baseUrl: string, value: string): string | undefined {
  if (!value || value.startsWith("data:") || value.startsWith("javascript:") || value.startsWith("mailto:")) {
    return undefined;
  }
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return undefined;
  }
}

function extensionFromUrl(url: string, contentType: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.slice(pathname.lastIndexOf("."));
    if (ext && ext.length <= 8 && /^\.[a-z0-9]+$/.test(ext)) {
      return ext;
    }
  } catch {
    // fall through
  }
  if (contentType.includes("javascript")) {
    return ".js";
  }
  if (contentType.includes("css")) {
    return ".css";
  }
  return ".bin";
}

function pickSecurityHeaders(headers: Record<string, string>): Record<string, string> {
  const keys = [
    "content-security-policy",
    "content-security-policy-report-only",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "x-xss-protection",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "set-cookie",
  ];
  const selected: Record<string, string> = {};
  for (const key of keys) {
    if (headers[key]) {
      selected[key] = headers[key];
    }
  }
  return selected;
}

function collectThirdParties(hostname: string, urls: string[]): string[] {
  const originHost = hostname.replace(/^www\./i, "").toLowerCase();
  const hosts = new Set<string>();
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
      if (host && host !== originHost && !host.endsWith(`.${originHost}`)) {
        hosts.add(host);
      }
    } catch {
      continue;
    }
  }
  return [...hosts].sort();
}

function detectFrameworks(html: string, scripts: string[]): string[] {
  const haystack = `${html}\n${scripts.join("\n")}`.toLowerCase();
  const detected: string[] = [];
  const signatures: Array<[string, RegExp]> = [
    ["nextjs", /_next\/static|__next_data__/],
    ["react", /react(?:-dom)?[\w.-]*\.js|data-reactroot/],
    ["vue", /\bvue(?:\.runtime)?[\w.-]*\.js|data-v-/],
    ["angular", /ng-version=|angular[\w.-]*\.js/],
    ["svelte", /svelte[\w.-]*\.js/],
    ["wordpress", /wp-content|wp-includes/],
    ["shopify", /cdn\.shopify\.com|myshopify\.com/],
    ["magento", /mage\/cookies|magento/],
    ["cloudflare", /cdn-cgi\/|cloudflareinsights/],
  ];
  for (const [name, pattern] of signatures) {
    if (pattern.test(haystack)) {
      detected.push(name);
    }
  }
  return detected;
}

function parseSetCookie(header: string): Array<Record<string, boolean | string>> {
  if (!header) {
    return [];
  }
  return header.split(/,(?=[^ ;]+=)/).slice(0, 12).map((part) => {
    const segments = part.split(";").map((item) => item.trim());
    const [nameValue] = segments;
    const name = nameValue?.split("=")[0] ?? "cookie";
    const flags = new Set(segments.slice(1).map((flag) => flag.toLowerCase().split("=")[0] ?? ""));
    return {
      httpOnly: flags.has("httponly"),
      name,
      secure: flags.has("secure"),
      sameSite: segments.find((flag) => flag.toLowerCase().startsWith("samesite=")) ?? "",
    };
  });
}

function buildCrawlReadme(profile: {
  description: string;
  frameworks: string[];
  startUrl: string;
  thirdParties: string[];
  title: string;
  pages: Array<{ path: string; url: string }>;
}): string {
  return [
    `# ${profile.title}`,
    "",
    `Captured from \`${profile.startUrl}\`.`,
    "",
    profile.description,
    "",
    "## Captured pages",
    "",
    ...profile.pages.map((page) => `- [${page.url}](${page.path})`),
    "",
    "## Detected frameworks",
    "",
    profile.frameworks.length > 0 ? profile.frameworks.map((item) => `- ${item}`).join("\n") : "- none",
    "",
    "## Third-party hosts",
    "",
    profile.thirdParties.length > 0
      ? profile.thirdParties.map((item) => `- ${item}`).join("\n")
      : "- none observed on the homepage",
    "",
    "This snapshot is a **limited public crawl** (homepage + a few same-origin pages and assets).",
    "It is not a full source dump of the live application.",
    "",
  ].join("\n");
}
