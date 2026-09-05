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

// eslint-disable-next-line @typescript-eslint/no-namespace -- module augmentation requires namespace syntax
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}

