import { AppError, ErrorCode, type MembershipRole } from "@ai-archaeologist/shared";
import type { AuthContext } from "../types.js";

const roleRank: Record<MembershipRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  ANALYST: 30,
  DEVELOPER: 20,
  VIEWER: 10,
};

export function assertOrganizationRole(
  auth: AuthContext | undefined,
  organizationId: string,
  minimumRole: MembershipRole,
): void {
  if (!auth) {
    throw new AppError({
      code: ErrorCode.AuthenticationRequired,
      message: "Authentication is required.",
      statusCode: 401,
    });
  }

  const membership = auth.memberships.find((candidate) => candidate.organizationId === organizationId);

  if (!membership || roleRank[membership.role] < roleRank[minimumRole]) {
    throw new AppError({
      code: ErrorCode.AuthorizationDenied,
      message: "You do not have access to this organization.",
      statusCode: 403,
    });
  }
}

