import { createHmac, randomBytes } from "node:crypto";
import type { Response } from "express";

const sessionTtlDays = 14;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function getSessionExpiry(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + sessionTtlDays);
  return expiresAt;
}

export function setSessionCookie(args: {
  cookieName: string;
  expiresAt: Date;
  response: Response;
  secure: boolean;
  token: string;
}): void {
  args.response.cookie(args.cookieName, args.token, {
    expires: args.expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: args.secure,
  });
}

export function clearSessionCookie(response: Response, cookieName: string, secure: boolean): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  });
}
