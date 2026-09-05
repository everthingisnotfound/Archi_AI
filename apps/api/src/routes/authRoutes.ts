import { randomUUID } from "node:crypto";
import {
  AppError,
  ErrorCode,
  loginRequestSchema,
  registerRequestSchema,
} from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import type { ApiConfig } from "../config.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { issueCsrfToken } from "../http/csrf.js";
import type { AppLogger } from "../logger.js";
import { recordAuditEvent } from "../audit/auditLog.js";
import { createAuthMiddleware } from "../auth/authMiddleware.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
  setSessionCookie,
} from "../auth/session.js";

function createSlug(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return `${base || "organization"}-${randomUUID().slice(0, 8)}`;
}

async function createSessionForUser(args: {
  config: ApiConfig;
  prisma: PrismaClient;
  requestIp?: string | undefined;
  userAgent?: string | undefined;
  userId: string;
}) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiry();
  const session = await args.prisma.session.create({
    data: {
      expiresAt,
      ipAddress: args.requestIp ?? null,
      tokenHash: hashSessionToken(token, args.config.SESSION_SECRET),
      userAgent: args.userAgent ?? null,
      userId: args.userId,
    },
  });

  return { expiresAt, session, token };
}

export function createAuthRouter(
  prisma: PrismaClient,
  config: ApiConfig,
  logger: AppLogger,
): Router {
  const router = Router();
  const secureCookie = config.NODE_ENV === "production";
  const requireAuth = createAuthMiddleware(prisma, config);

  router.get("/csrf", (_request, response) => {
    response.json({ csrfToken: issueCsrfToken(response, secureCookie) });
  });

  router.post(
    "/register",
    asyncHandler(async (request, response) => {
      const body = registerRequestSchema.parse(request.body);
      const passwordHash = await hashPassword(body.password);

      const existingUser = await prisma.user.findUnique({
        where: {
          email: body.email,
        },
      });

      if (existingUser) {
        throw new AppError({
          code: ErrorCode.Conflict,
          message: "An account already exists for this email address.",
          statusCode: 409,
        });
      }

      const result = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email: body.email,
            name: body.name,
            passwordHash,
          },
        });
        const organization = await transaction.organization.create({
          data: {
            name: body.organizationName,
            slug: createSlug(body.organizationName),
          },
        });
        await transaction.user.update({
          data: {
            createdOrganizationId: organization.id,
          },
          where: {
            id: user.id,
          },
        });
        const membership = await transaction.membership.create({
          data: {
            organizationId: organization.id,
            role: "OWNER",
            userId: user.id,
          },
        });
        return { membership, organization, user };
      });

      const { expiresAt, token } = await createSessionForUser({
        config,
        prisma,
        requestIp: request.ip,
        userAgent: request.header("user-agent"),
        userId: result.user.id,
      });

      setSessionCookie({
        cookieName: config.SESSION_COOKIE_NAME,
        expiresAt,
        response,
        secure: secureCookie,
        token,
      });

      await recordAuditEvent(prisma, request, {
        action: "auth.register",
        organizationId: result.organization.id,
        resourceId: result.user.id,
        resourceType: "User",
        userId: result.user.id,
      });

      logger.info({ requestId: request.requestId, userId: result.user.id }, "user registered");
      response.status(201).json({
        memberships: [
          {
            organizationId: result.membership.organizationId,
            role: result.membership.role,
          },
        ],
        organization: result.organization,
        user: {
          email: result.user.email,
          id: result.user.id,
          name: result.user.name,
        },
      });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (request, response) => {
      const body = loginRequestSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        include: {
          memberships: true,
        },
        where: {
          email: body.email,
        },
      });

      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
        throw new AppError({
          code: ErrorCode.InvalidCredentials,
          message: "Invalid credentials.",
          statusCode: 401,
        });
      }

      const { expiresAt, token } = await createSessionForUser({
        config,
        prisma,
        requestIp: request.ip,
        userAgent: request.header("user-agent"),
        userId: user.id,
      });

      setSessionCookie({
        cookieName: config.SESSION_COOKIE_NAME,
        expiresAt,
        response,
        secure: secureCookie,
        token,
      });

      await recordAuditEvent(prisma, request, {
        action: "auth.login",
        resourceId: user.id,
        resourceType: "User",
        userId: user.id,
      });

      response.json({
        memberships: user.memberships.map((membership) => ({
          organizationId: membership.organizationId,
          role: membership.role,
        })),
        user: {
          email: user.email,
          id: user.id,
          name: user.name,
        },
      });
    }),
  );

  router.post(
    "/logout",
    requireAuth,
    asyncHandler(async (request, response) => {
      const sessionId = request.auth?.sessionId;
      if (!sessionId) {
        throw new AppError({
          code: ErrorCode.AuthenticationRequired,
          message: "Authentication is required.",
          statusCode: 401,
        });
      }

      await prisma.session.update({
        data: {
          revokedAt: new Date(),
        },
        where: {
          id: sessionId,
        },
      });
      clearSessionCookie(response, config.SESSION_COOKIE_NAME, secureCookie);
      response.status(204).send();
    }),
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (request, response) => {
      response.json({
        memberships: request.auth?.memberships ?? [],
        user: request.auth?.user,
      });
      return Promise.resolve();
    }),
  );

  return router;
}
