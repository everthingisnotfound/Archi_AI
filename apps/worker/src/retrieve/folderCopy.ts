import { cp } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { folderStagingDirectory } from "@ai-archaeologist/shared";
import type { WorkerConfig } from "../config.js";

export async function copyFolderStaging(
  workspaceRoot: string,
  sourceId: string,
  targetDirectory: string,
  _config: WorkerConfig,
): Promise<void> {
  const stagingDirectory = folderStagingDirectory(workspaceRoot, sourceId);
  await mkdir(targetDirectory, { recursive: true });
  await cp(stagingDirectory, targetDirectory, { force: true, recursive: true });
}
