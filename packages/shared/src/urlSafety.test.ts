import { describe, expect, it } from "vitest";
import { isPrivateOrLocalHostname, parsePublicHttpUrl, repositoryNameFromWebsiteUrl } from "./urlSafety.js";

describe("parsePublicHttpUrl", () => {
  it("accepts public https URLs", () => {
    expect(parsePublicHttpUrl("https://www.flipkart.com/").hostname).toBe("www.flipkart.com");
  });

  it("rejects localhost and private addresses", () => {
    expect(() => parsePublicHttpUrl("http://localhost:3000")).toThrow();
    expect(() => parsePublicHttpUrl("http://127.0.0.1")).toThrow();
    expect(() => parsePublicHttpUrl("http://192.168.1.10")).toThrow();
    expect(() => parsePublicHttpUrl("http://169.254.169.254/latest/meta-data")).toThrow();
  });
});

describe("isPrivateOrLocalHostname", () => {
  it("flags loopback and RFC1918 hosts", () => {
    expect(isPrivateOrLocalHostname("10.0.0.4")).toBe(true);
    expect(isPrivateOrLocalHostname("example.com")).toBe(false);
  });
});

describe("repositoryNameFromWebsiteUrl", () => {
  it("uses hostname without www", () => {
    expect(repositoryNameFromWebsiteUrl("https://www.amazon.in/gp/cart")).toContain("amazon.in");
  });
});
