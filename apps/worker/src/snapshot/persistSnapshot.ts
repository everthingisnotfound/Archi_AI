import type { PrismaClient } from "@prisma/client";
import type { RepositoryScanResult } from "../scan/repositoryScan.js";

export type PersistSnapshotInput = {
  commitSha?: string | undefined;
  organizationId: string;
  repositoryId: string;
  scan: RepositoryScanResult;
};

export async function persistRepositorySnapshot(
  prisma: PrismaClient,
  input: PersistSnapshotInput,
): Promise<{ snapshotId: string }> {
  const snapshot = await prisma.$transaction(async (transaction) => {
    const createdSnapshot = await transaction.repositorySnapshot.create({
      data: {
        commitSha: input.commitSha ?? null,
        contentHash: input.scan.contentHash,
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
      },
    });

    await transaction.fileNode.createMany({
      data: input.scan.files.map((file) => ({
        contentHash: file.contentHash,
        language: file.language ?? null,
        organizationId: input.organizationId,
        path: file.path,
        repositoryId: input.repositoryId,
        sizeBytes: file.sizeBytes,
        snapshotId: createdSnapshot.id,
      })),
    });

    return createdSnapshot;
  });

  return { snapshotId: snapshot.id };
}
