import { AppError, ErrorCode, type MembershipRole } from "@ai-archaeologist/shared";
import type { PrismaClient, Repository } from "@prisma/client";
import type { AuthContext } from "../types.js";
import { assertOrganizationRole } from "../auth/rbac.js";

export async function loadRepositoryForOrganization(
  prisma: PrismaClient,
  auth: AuthContext | undefined,
  repositoryId: string,
  minimumRole: MembershipRole,
): Promise<Repository> {
  const repository = await prisma.repository.findUnique({
    where: {
      id: repositoryId,
    },
  });

  if (!repository) {
    throw new AppError({
      code: ErrorCode.NotFound,
      message: "Repository was not found.",
      statusCode: 404,
    });
  }

  assertOrganizationRole(auth, repository.organizationId, minimumRole);
  return repository;
}

export async function loadIngestionJobForRepository(
  prisma: PrismaClient,
  auth: AuthContext | undefined,
  repositoryId: string,
  ingestionJobId: string,
  minimumRole: MembershipRole,
) {
  await loadRepositoryForOrganization(prisma, auth, repositoryId, minimumRole);

  const ingestionJob = await prisma.ingestionJob.findFirst({
    include: {
      source: true,
    },
    where: {
      id: ingestionJobId,
      repositoryId,
    },
  });

  if (!ingestionJob) {
    throw new AppError({
      code: ErrorCode.NotFound,
      message: "Ingestion job was not found.",
      statusCode: 404,
    });
  }

  return ingestionJob;
}

export async function loadSnapshotForRepository(
  prisma: PrismaClient,
  auth: AuthContext | undefined,
  repositoryId: string,
  snapshotId: string,
  minimumRole: MembershipRole,
) {
  await loadRepositoryForOrganization(prisma, auth, repositoryId, minimumRole);

  const snapshot = await prisma.repositorySnapshot.findFirst({
    where: {
      id: snapshotId,
      repositoryId,
    },
  });

  if (!snapshot) {
    throw new AppError({
      code: ErrorCode.NotFound,
      message: "Repository snapshot was not found.",
      statusCode: 404,
    });
  }

  return snapshot;
}
