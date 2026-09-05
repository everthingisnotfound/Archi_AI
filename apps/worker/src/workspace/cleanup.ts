import { rm } from "node:fs/promises";
import { jobWorkspaceDirectory } from "@ai-archaeologist/shared";

export async function resetJobWorkspace(
  workspaceRoot: string,
  ingestionJobId: string,
): Promise<string> {
  const jobWorkspace = jobWorkspaceDirectory(workspaceRoot, ingestionJobId);
  await rm(jobWorkspace, { force: true, recursive: true });
  return jobWorkspace;
}

export async function removeJobWorkspace(workspaceRoot: string, ingestionJobId: string): Promise<void> {
  await rm(jobWorkspaceDirectory(workspaceRoot, ingestionJobId), { force: true, recursive: true });
}
