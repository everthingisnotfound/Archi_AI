import { AppError, ErrorCode } from "./errors.js";
import { repositoryLimitDefaults } from "./limits.js";
import { normalizePosixPath } from "./posixPath.js";

const windowsDrivePattern = /^[a-zA-Z]:/;

export function normalizeRepositoryRelativePath(input: string): string {
  const normalizedSlashes = input.replaceAll("\\", "/").trim();

  if (
    normalizedSlashes.length === 0 ||
    normalizedSlashes.length > repositoryLimitDefaults.maxPathLength ||
    normalizedSlashes.startsWith("/") ||
    windowsDrivePattern.test(normalizedSlashes) ||
    normalizedSlashes.includes("\0")
  ) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Repository path is invalid.",
      statusCode: 400,
    });
  }

  const rawSegments = normalizedSlashes.split("/");
  if (rawSegments.includes("..")) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Repository path must stay inside the repository workspace.",
      statusCode: 400,
    });
  }

  const normalized = normalizePosixPath(normalizedSlashes);
  const segments = normalized.split("/");

  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    segments.includes("..") ||
    segments.length > repositoryLimitDefaults.maxPathSegments
  ) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Repository path must stay inside the repository workspace.",
      statusCode: 400,
    });
  }

  return normalized;
}
