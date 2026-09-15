import type {
  CapturedPage,
  DiscoveredEndpoint,
  FormProfile,
  ResourceReference,
  WebsiteCrawlProfile,
} from "./websiteCrawl.js";

export type InventoryResponse = {
  contentType: string;
  status: number;
  truncated?: boolean;
};

export type InventoryProvenance = {
  discoveredFrom?: string;
  pageUrl?: string;
  depth: number;
  source: "page" | "endpoint" | "form" | "resource";
};

export type InventoryPage = {
  contentType: string;
  depth: number;
  path: string;
  provenance: InventoryProvenance[];
  response: InventoryResponse;
  url: string;
};

export type InventoryEndpoint = {
  method: "GET";
  path: string;
  provenance: InventoryProvenance[];
  response: InventoryResponse;
  source?: string;
  url: string;
};

export type InventoryForm = FormProfile & {
  depth: number;
  pageUrl: string;
  provenance: InventoryProvenance[];
};

export type InventoryQueryParameter = {
  name: string;
  provenance: InventoryProvenance[];
  urls: string[];
  values: string[];
};

export type InventoryResource = {
  kind: ResourceReference["kind"];
  path?: string;
  provenance: InventoryProvenance[];
  url: string;
};

export type AttackSurfaceInventory = {
  version: 1;
  scopeOrigin: string;
  pages: InventoryPage[];
  endpoints: InventoryEndpoint[];
  forms: InventoryForm[];
  queryParameters: InventoryQueryParameter[];
  resources: InventoryResource[];
};

/**
 * Converts the passive crawl profile into a stable, same-origin attack-surface
 * inventory. This function is deliberately pure: it performs no requests.
 */
export function buildAttackSurfaceInventory(profile: WebsiteCrawlProfile): AttackSurfaceInventory {
  const origin = new URL(profile.scopeOrigin).origin;
  const pages = dedupePages(profile.pages, origin);
  const endpoints = dedupeEndpoints(profile.endpoints, origin, profile.pages);
  const forms = dedupeForms(profile.pages, origin);
  const resources = dedupeResources(profile.pages, profile.assets, origin);
  const queryParameters = collectQueryParameters([...pages, ...endpoints, ...forms, ...resources]);
  return { version: 1, scopeOrigin: origin, pages, endpoints, forms, queryParameters, resources };
}

function dedupePages(input: CapturedPage[], origin: string): InventoryPage[] {
  const records = new Map<string, InventoryPage>();
  for (const page of input) {
    const url = canonicalize(page.url);
    if (!isSameOrigin(url, origin)) continue;
    const existing = records.get(url);
    const provenance = pageProvenance(page);
    if (existing) {
      existing.provenance = mergeProvenance(existing.provenance, provenance);
      existing.depth = Math.min(existing.depth, page.depth);
      continue;
    }
    records.set(url, {
      contentType: page.contentType,
      depth: page.depth,
      path: page.path,
      provenance,
      response: { contentType: page.contentType, status: page.status, truncated: page.truncated },
      url,
    });
  }
  return [...records.values()].sort(byUrl);
}

function dedupeEndpoints(input: DiscoveredEndpoint[], origin: string, pages: CapturedPage[]): InventoryEndpoint[] {
  const records = new Map<string, InventoryEndpoint>();
  for (const endpoint of input) {
    const url = canonicalize(endpoint.url);

    if (!isSameOrigin(url, origin)) continue;

    const sourcePage = pages.find((page) =>
      page.resources.some(
        (resource) =>
          canonicalize(resource.url) === canonicalize(endpoint.source),
      ),
    );

    const provenance: InventoryProvenance = {
      ...(sourcePage ? { pageUrl: canonicalize(sourcePage.url) } : {}),
      depth: sourcePage?.depth ?? 0,
      source: "endpoint",
    };

    const existing = records.get(url);

    if (existing) {
      existing.provenance = mergeProvenance(existing.provenance, [provenance]);
      continue;
    }

    records.set(url, {
      method: "GET",
      path: endpoint.path,
      provenance: [provenance],
      response: {
        contentType: endpoint.contentType,
        status: endpoint.status,
      },
      ...(endpoint.source ? { source: canonicalize(endpoint.source) } : {}),
      url,
    });
  }
  return [...records.values()].sort(byUrl);
}

function dedupeForms(pages: CapturedPage[], origin: string): InventoryForm[] {
  const records = new Map<string, InventoryForm>();
  for (const page of pages) {
    const pageUrl = canonicalize(page.url);
    if (!isSameOrigin(pageUrl, origin)) continue;
    for (const form of page.forms) {
      const action = canonicalize(form.action);
      if (!isSameOrigin(action, origin)) continue;
      const key = `${form.method}:${action}:${form.fieldCount}:${form.hasFileInput}:${form.hasPasswordInput}`;
      const provenance = [{ depth: page.depth, pageUrl, source: "form" as const }];
      const existing = records.get(key);
      if (existing) {
        existing.provenance = mergeProvenance(existing.provenance, provenance);
        existing.depth = Math.min(existing.depth, page.depth);
        continue;
      }
      records.set(key, { ...form, action, depth: page.depth, pageUrl, provenance });
    }
  }
  return [...records.values()].sort((a, b) => `${a.method}:${a.action}`.localeCompare(`${b.method}:${b.action}`));
}

function dedupeResources(
  pages: CapturedPage[],
  assets: WebsiteCrawlProfile["assets"],
  origin: string,
): InventoryResource[] {
  const records = new Map<string, InventoryResource>();
  for (const page of pages) {
    const pageUrl = canonicalize(page.url);
    if (!isSameOrigin(pageUrl, origin)) continue;
    for (const resource of page.resources) {
      const url = canonicalize(resource.url);
      if (!isSameOrigin(url, origin)) continue;
      const provenance = [{ depth: page.depth, pageUrl, source: "resource" as const }];
      const key = `${resource.kind}:${url}`;
      const existing = records.get(key);
      if (existing) {
        existing.provenance = mergeProvenance(existing.provenance, provenance);
      } else {
        const asset = assets.find((candidate) => canonicalize(candidate.url) === url);
        records.set(key, { kind: resource.kind, ...(asset?.path ?? resource.path ? { path: asset?.path ?? resource.path } : {}), provenance, url });
      }
    }
  }
  return [...records.values()].sort((a, b) => `${a.kind}:${a.url}`.localeCompare(`${b.kind}:${b.url}`));
}

function collectQueryParameters(records: Array<{ url?: string; action?: string; provenance: InventoryProvenance[] }>): InventoryQueryParameter[] {
  const parameters = new Map<string, InventoryQueryParameter>();
  for (const record of records) {
    const url = record.url ?? record.action;
    if (!url) continue;
    for (const [name, value] of new URL(url).searchParams) {
      const existing = parameters.get(name) ?? { name, provenance: [], urls: [], values: [] };
      if (!existing.urls.includes(url)) existing.urls.push(url);
      if (!existing.values.includes(value)) existing.values.push(value);
      existing.provenance = mergeProvenance(existing.provenance, record.provenance);
      parameters.set(name, existing);
    }
  }
  return [...parameters.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function pageProvenance(page: CapturedPage): InventoryProvenance[] {
  return [{
    ...(page.discoveredFrom ? { discoveredFrom: canonicalize(page.discoveredFrom) } : {}),
    depth: page.depth,
    source: "page",
  }];
}

function mergeProvenance(left: InventoryProvenance[], right: InventoryProvenance[]): InventoryProvenance[] {
  const values = new Map(left.concat(right).map((item) => [JSON.stringify(item), item]));
  return [...values.values()].sort((a, b) => a.depth - b.depth || JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function canonicalize(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_[\w-]+|fbclid|gclid|mc_[\w-]+)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}

function isSameOrigin(url: string, origin: string): boolean {
  return new URL(url).origin === origin;
}

function byUrl(a: { url: string }, b: { url: string }): number {
  return a.url.localeCompare(b.url);
}
