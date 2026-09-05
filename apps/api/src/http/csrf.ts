import { randomBytes, timingSafeEqual } from "node:crypto";
import { AppError, ErrorCode } from "@ai-archaeologist/shared";
import type { NextFunction, Request, Response } from "express";

const csrfCookieName = "asa_csrf";
const csrfHeaderName = "x-csrf-token";
const csrfExemptPaths = new Set(["/auth/csrf", "/auth/login", "/auth/register"]);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function issueCsrfToken(response: Response, secure: boolean): string {
  const token = randomBytes(32).toString("base64url");
  response.cookie(csrfCookieName, token, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
  });
  return token;
}

export function csrfMiddleware(request: Request, _response: Response, next: NextFunction): void {
  if (safeMethods.has(request.method) || csrfExemptPaths.has(request.path)) {
    next();
    return;
  }

  const cookies = request.cookies as Record<string, string | undefined>;
  const cookieToken = cookies[csrfCookieName];
  const headerToken = request.header(csrfHeaderName);

  if (!cookieToken || !headerToken || !constantTimeEquals(cookieToken, headerToken)) {
    next(
      new AppError({
        code: ErrorCode.AuthorizationDenied,
        message: "CSRF validation failed.",
        statusCode: 403,
      }),
    );
    return;
  }

  next();
}

