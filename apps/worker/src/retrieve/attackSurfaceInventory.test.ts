import { describe, expect, it } from "vitest";
import { buildAttackSurfaceInventory } from "./attackSurfaceInventory.js";
import type { WebsiteCrawlProfile } from "./websiteCrawl.js";

function profile(): WebsiteCrawlProfile {
  return {
    assets: [{ kind: "script", path: "assets/app.js", url: "https://example.test/app.js" }],
    coverage: { complete: true, reasons: [] },
    endpoints: [{
      contentType: "application/json",
      method: "GET",
      path: "endpoints/000.json",
      source: "https://example.test/app.js",
      status: 200,
      url: "https://example.test/api/users?b=2&a=1&utm_source=test",
    }],
    crawl: { discoveredCount: 1, failedCount: 0, maxDepth: 2, maxPages: 10, requestDelayMs: 100, skippedCount: 0 },
    cookies: [],
    pages: [{
      contentType: "text/html",
      cookies: [],
      depth: 0,
      externalLinkCount: 0,
      forms: [{
        action: "https://example.test/search?term=one",
        fieldCount: 1,
        hasFileInput: false,
        hasPasswordInput: false,
        method: "GET",
      }],
      links: ["https://example.test/about"],
      path: "pages/index.html",
      resources: [{
        integrity: true,
        kind: "script",
        thirdParty: false,
        url: "https://example.test/app.js",
      }, {
        integrity: false,
        kind: "script",
        thirdParty: true,
        url: "https://other.test/tracker.js",
      }],
      securityHeaders: {},
      status: 200,
      targetBlankWithoutNoopener: 0,
      title: "Home",
      truncated: false,
      url: "https://example.test/?utm_campaign=x",
    }, {
      contentType: "text/html",
      cookies: [],
      depth: 1,
      discoveredFrom: "https://example.test/",
      externalLinkCount: 0,
      forms: [],
      links: [],
      path: "pages/page-001.html",
      resources: [],
      securityHeaders: {},
      status: 200,
      targetBlankWithoutNoopener: 0,
      title: "Home again",
      truncated: false,
      url: "https://example.test/?",
    }],
    robots: { allowed: true, ruleCount: 0, url: "https://example.test/robots.txt" },
    scopeOrigin: "https://example.test",
    securityHeaders: {},
    startUrl: "https://example.test/",
    thirdParties: ["other.test"],
    title: "Home",
    version: 2,
  };
}

describe("buildAttackSurfaceInventory", () => {
  it("deduplicates canonical URLs, preserves provenance, and extracts query parameters", () => {
    const inventory = buildAttackSurfaceInventory(profile());

    expect(inventory.pages).toHaveLength(1);
    expect(inventory.pages[0]?.url).toBe("https://example.test/");
    expect(inventory.pages[0]?.provenance).toHaveLength(2);
    expect(inventory.endpoints[0]?.url).toBe("https://example.test/api/users?a=1&b=2");
    expect(inventory.endpoints[0]?.response).toEqual({ contentType: "application/json", status: 200 });
    expect(inventory.resources).toHaveLength(1);
    expect(inventory.forms).toHaveLength(1);
    expect(inventory.queryParameters.map((parameter) => parameter.name)).toEqual(["a", "b", "term"]);
  });

  it("does not include third-party or non-GET surface records", () => {
    const input = profile();
    input.endpoints.push({
      contentType: "text/html",
      method: "GET",
      path: "external",
      source: "https://example.test/app.js",
      status: 200,
      url: "https://other.test/api",
    });
    input.pages[0]!.forms.push({
      action: "https://other.test/submit",
      fieldCount: 0,
      hasFileInput: false,
      hasPasswordInput: false,
      method: "POST",
    });

    const inventory = buildAttackSurfaceInventory(input);
    expect(inventory.endpoints).toHaveLength(1);
    expect(inventory.forms).toHaveLength(1);
    expect(inventory.resources.every((resource) => resource.url.startsWith("https://example.test"))).toBe(true);
  });
});
