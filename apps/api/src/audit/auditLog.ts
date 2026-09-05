import type { Prisma, PrismaClient } from "@prisma/client";
import type { Request } from "express";

export async function recordAuditEvent(
  prisma: PrismaClient,
  request: Request,
  args: {
    action: string;
    metadata?: Prisma.InputJsonObject;
    organizationId?: string | undefined;
    resourceId?: string | undefined;
    resourceType: string;
    userId?: string | undefined;
  },
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      action: args.action,
      ipAddress: request.ip ?? null,
      metadata: args.metadata ?? {},
      organizationId: args.organizationId ?? null,
      resourceId: args.resourceId ?? null,
      resourceType: args.resourceType,
      userAgent: request.header("user-agent") ?? null,
      userId: args.userId ?? null,
    },
  });
}
