import { ZodError } from "zod";

export enum ErrorCode {
  AuthenticationRequired = "AUTHENTICATION_REQUIRED",
  AuthorizationDenied = "AUTHORIZATION_DENIED",
  Conflict = "CONFLICT",
  InvalidCredentials = "INVALID_CREDENTIALS",
  InvalidInput = "INVALID_INPUT",
  NotFound = "NOT_FOUND",
  RateLimited = "RATE_LIMITED",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
  Unexpected = "UNEXPECTED_ERROR",
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details: unknown;
  public readonly exposeDetails: boolean;
  public readonly statusCode: number;

  public constructor(args: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: unknown;
    exposeDetails?: boolean;
  }) {
    super(args.message);
    this.name = "AppError";
    this.code = args.code;
    this.statusCode = args.statusCode;
    this.details = args.details;
    this.exposeDetails = args.exposeDetails ?? false;
  }
}

export type SafeErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export function toSafeErrorResponse(error: unknown, includeUnexpectedDetails: boolean): SafeErrorResponse {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.exposeDetails ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.length > 0 ? issue.path.join(".") : undefined,
    }));
    const message =
      details.length === 1 && details[0]
        ? details[0].message
        : details
            .map((detail) =>
              detail.path ? `${detail.path}: ${detail.message}` : detail.message,
            )
            .join(" ");

    return {
      error: {
        code: ErrorCode.InvalidInput,
        details,
        message,
      },
    };
  }

  return {
    error: {
      code: ErrorCode.Unexpected,
      message: "An unexpected error occurred.",
      ...(includeUnexpectedDetails ? { details: String(error) } : {}),
    },
  };
}

export function getHttpStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }

  if (error instanceof ZodError) {
    return 400;
  }

  return 500;
}
