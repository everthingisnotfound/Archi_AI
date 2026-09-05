import { AppError, ErrorCode, type HealthStatus } from "@ai-archaeologist/shared";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";
import type { ApiConfig } from "./config.js";
import { createAuthMiddleware } from "./auth/authMiddleware.js";
import { createErrorHandler } from "./http/errorHandler.js";
import { csrfMiddleware } from "./http/csrf.js";
import { requestIdMiddleware } from "./http/requestId.js";
import { createRateLimitMiddleware } from "./http/rateLimit.js";
import type { JobPublisher } from "./jobs/jobPublisher.js";
import type { AppLogger } from "./logger.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createChatRouter } from "./routes/chatRoutes.js";
import { createRepositoryRouter } from "./routes/repositoryRoutes.js";
import { asyncHandler } from "./http/asyncHandler.js";

export type ApiDependencies = {
  config: ApiConfig;
  jobPublisher: JobPublisher;
  logger: AppLogger;
  prisma: PrismaClient;
  redis: Redis;
};

export function createApiApp(dependencies: ApiDependencies): express.Express {
  const app = express();
  const { config, jobPublisher, logger, prisma, redis } = dependencies;

  app.disable("x-powered-by");
  app.set("trust proxy", config.NODE_ENV === "production" ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: config.CORS_ORIGIN,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  app.get("/healthz", (_request, response) => {
    response.json({
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString(),
    } satisfies HealthStatus);
  });

  app.get(
    "/readyz",
    asyncHandler(async (_request, response) => {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      response.json({
        service: "api",
        status: "ok",
        timestamp: new Date().toISOString(),
      } satisfies HealthStatus);
    }),
  );

  app.use(createRateLimitMiddleware(redis, config, logger));
  app.use(csrfMiddleware);
  app.use("/auth", createAuthRouter(prisma, config, logger));
  app.use(createAuthMiddleware(prisma, config));
  app.use(createRepositoryRouter(prisma, config, jobPublisher));
  app.use(createChatRouter(prisma, config));

  app.use((_request, _response, next) => {
    next(
      new AppError({
        code: ErrorCode.NotFound,
        message: "Route not found.",
        statusCode: 404,
      }),
    );
  });
  app.use(createErrorHandler(config, logger));

  return app;
}
