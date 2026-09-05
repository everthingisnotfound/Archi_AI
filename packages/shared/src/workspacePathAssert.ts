import path from "node:path";
import { AppError, ErrorCode } from "./errors.js";

export function assertWorkspaceChild(workspaceRoot: string, candidatePath: string): string {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedCandidate = path.resolve(resolvedRoot, candidatePath);
  const relative = path.relative(resolvedRoot, resolvedCandidate);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Resolved path escapes the repository workspace.",
      statusCode: 400,
    });
  }

  return resolvedCandidate;
}
