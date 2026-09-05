import { AppError, ErrorCode } from "@ai-archaeologist/shared";
import type { NextFunction, Request, Response } from "express";
import type { Redis } from "ioredis";
import type { ApiConfig } from "../config.js";
import type { AppLogger } from "../logger.js";

export function createRateLimitMiddleware(
  redis: Redis,
  config: ApiConfig,
  logger: AppLogger,
) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const principal = request.auth?.user.id ?? request.ip ?? "anonymous";
    const key = `rate-limit:${request.method}:${request.path}:${principal}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, config.RATE_LIMIT_WINDOW_SECONDS);
      }

      response.setHeader("x-rate-limit-limit", String(config.RATE_LIMIT_MAX_REQUESTS));
      response.setHeader("x-rate-limit-remaining", String(Math.max(0, config.RATE_LIMIT_MAX_REQUESTS - count)));

      if (count > config.RATE_LIMIT_MAX_REQUESTS) {
        next(
          new AppError({
            code: ErrorCode.RateLimited,
            message: "Too many requests.",
            statusCode: 429,
          }),
        );
        return;
      }

      next();
    } catch (error) {
      logger.error({ err: error, requestId: request.requestId }, "rate limit check failed");

      if (config.RATE_LIMIT_FAIL_CLOSED || config.NODE_ENV === "production") {
        next(
          new AppError({
            code: ErrorCode.ServiceUnavailable,
            message: "Rate limiting service is unavailable.",
            statusCode: 503,
          }),
        );
        return;
      }

      next();
    }
  };
}
