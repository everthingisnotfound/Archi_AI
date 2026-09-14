import { AppError, ErrorCode } from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { ApiConfig } from "../config.js";
import { hashSessionToken } from "./session.js";

export function createAuthMiddleware(prisma: PrismaClient, config: ApiConfig) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = request.cookies as Record<string, string | undefined>;
      const token = cookies[config.SESSION_COOKIE_NAME];

      if (!token) {
        const error = new AppError({
          code: ErrorCode.AuthenticationRequired,
          message: "Authentication is required.",
          statusCode: 401,
        });
        response.status(401).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      const tokenHash = hashSessionToken(token, config.SESSION_SECRET);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              memberships: true,
            },
          },
        },
      });

      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        const error = new AppError({
          code: ErrorCode.AuthenticationRequired,
          message: "Session is invalid or expired.",
          statusCode: 401,
        });
        response.status(401).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      request.auth = {
        memberships: session.user.memberships.map((membership) => ({
          organizationId: membership.organizationId,
          role: membership.role,
        })),
        sessionId: session.id,
        user: {
          email: session.user.email,
          id: session.user.id,
          name: session.user.name,
        },
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

