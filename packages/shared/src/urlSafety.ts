const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
]);

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.+$/, "");
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }

  if (host.includes(":")) {
    return isPrivateIpv6(host);
  }

  return isPrivateIpv4(host);
}

export function isPrivateIpv4(address: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!match) {
    return false;
  }

  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
    return false;
  }

  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

export function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isPrivateIpv4(mapped);
  }
  return false;
}

export function parsePublicHttpUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("URL is invalid.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed.");
  }

  if (!parsed.hostname) {
    throw new Error("URL hostname is required.");
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error("Private, local, and metadata URLs cannot be analyzed.");
  }

  return parsed;
}

export function repositoryNameFromWebsiteUrl(url: string): string {
  const parsed = parsePublicHttpUrl(url);
  const host = parsed.hostname.replace(/^www\./i, "");
  const pathSlug = parsed.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2)
    .join("-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);

  const name = pathSlug ? `${host}-${pathSlug}` : host;
  return name.slice(0, 180);
}
