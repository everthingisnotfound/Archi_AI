import path from "node:path";

export function sourceStagingDirectory(workspaceRoot: string, sourceId: string): string {
  return path.join(workspaceRoot, "staging", sourceId);
}

export function zipArchivePath(workspaceRoot: string, sourceId: string): string {
  return path.join(sourceStagingDirectory(workspaceRoot, sourceId), "archive.zip");
}

export function folderStagingDirectory(workspaceRoot: string, sourceId: string): string {
  return path.join(sourceStagingDirectory(workspaceRoot, sourceId), "files");
}

export function jobWorkspaceDirectory(workspaceRoot: string, ingestionJobId: string): string {
  return path.join(workspaceRoot, "jobs", ingestionJobId);
}

export function repositoryDirectoryInJob(jobWorkspace: string): string {
  return path.join(jobWorkspace, "repo");
}

export function snapshotWorkspaceDirectory(workspaceRoot: string, snapshotId: string): string {
  return path.join(workspaceRoot, "snapshots", snapshotId);
}

export function snapshotRepositoryDirectory(workspaceRoot: string, snapshotId: string): string {
  return path.join(snapshotWorkspaceDirectory(workspaceRoot, snapshotId), "repo");
}
