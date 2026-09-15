/* eslint-disable @typescript-eslint/no-namespace -- Express module augmentation requires namespace syntax */
import type { MembershipRole } from "@ai-archaeologist/shared";

export type AuthMembership = {
  organizationId: string;
  role: MembershipRole;
};

export type AuthContext = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  memberships: AuthMembership[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}
