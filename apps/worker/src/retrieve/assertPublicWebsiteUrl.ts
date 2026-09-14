import { lookup } from "node:dns/promises";
import { AppError, ErrorCode, isPrivateIpv4, isPrivateIpv6, parsePublicHttpUrl } from "@ai-archaeologist/shared";

export type PublicWebsiteAddress = {
  address: string;
  family: 4 | 6;
  url: URL;
};

export async function assertPublicWebsiteUrl(uri: string): Promise<URL> {
  return (await resolvePublicWebsiteAddress(uri)).url;
}

export async function resolvePublicWebsiteAddress(uri: string): Promise<PublicWebsiteAddress> {
  const parsed = parsePublicHttpUrl(uri);
  const resolved = await lookup(parsed.hostname, { all: true, verbatim: false });

  if (resolved.length === 0) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Website hostname could not be resolved.",
      statusCode: 400,
    });
  }

  for (const record of resolved) {
    const blocked = record.family === 6 ? isPrivateIpv6(record.address) : isPrivateIpv4(record.address);
    if (blocked) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: "Website hostname resolves to a private or local address.",
        statusCode: 400,
      });
    }
  }

  const preferred = resolved.find((record) => record.family === 4) ?? resolved[0];
  if (!preferred || (preferred.family !== 4 && preferred.family !== 6)) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Website hostname did not resolve to a supported public address.",
      statusCode: 400,
    });
  }
  return { address: preferred.address, family: preferred.family, url: parsed };
}
