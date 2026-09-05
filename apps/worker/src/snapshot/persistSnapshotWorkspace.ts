import { cp, rm } from "node:fs/promises";
import { snapshotRepositoryDirectory } from "@ai-archaeologist/shared";

export async function persistSnapshotWorkspace(
  workspaceRoot: string,
  snapshotId: string,
  repositoryRoot: string,
): Promise<string> {
  const snapshotRepositoryRoot = snapshotRepositoryDirectory(workspaceRoot, snapshotId);
  await rm(snapshotRepositoryRoot, { force: true, recursive: true });
  await cp(repositoryRoot, snapshotRepositoryRoot, { force: true, recursive: true });
  return snapshotRepositoryRoot;
}
