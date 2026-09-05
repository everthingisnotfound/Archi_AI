import { lookup } from "node:dns/promises";
import { AppError, ErrorCode, isPrivateIpv4, isPrivateIpv6, parsePublicHttpUrl } from "@ai-archaeologist/shared";

export async function assertPublicWebsiteUrl(uri: string): Promise<URL> {
  const parsed = parsePublicHttpUrl(uri);
  const resolved = await lookup(parsed.hostname, { all: true });

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

  return parsed;
}
