import { getHttpStatusCode, toSafeErrorResponse } from "@ai-archaeologist/shared";
import type { ErrorRequestHandler } from "express";
import type { ApiConfig } from "../config.js";
import type { AppLogger } from "../logger.js";

export function createErrorHandler(config: ApiConfig, logger: AppLogger): ErrorRequestHandler {
  return (error, request, response) => {
    const payload = toSafeErrorResponse(error, config.NODE_ENV !== "production");
    const safeStatusCode = getHttpStatusCode(error);

    logger.error(
      {
        err: error,
        requestId: request.requestId,
        statusCode: safeStatusCode,
      },
      "request failed",
    );

    response.status(safeStatusCode).json(payload);
  };
}
