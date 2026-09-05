import { createHmac } from "node:crypto";

export function signInternalJobToken(jobId: string, secret: string, issuedAt?: number): string {
  const timestamp = issuedAt ?? Math.floor(Date.now() / 1000);
  const message = `${jobId}.${timestamp}`;
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  return `${message}.${signature}`;
}
