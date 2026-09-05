import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertWorkspaceChild,
  folderStagingDirectory,
  normalizeRepositoryRelativePath,
  zipArchivePath,
} from "@ai-archaeologist/shared";

export type FolderUploadFile = {
  buffer: Buffer;
  relativePath: string;
};

export async function ensureWorkspaceRoot(workspaceRoot: string): Promise<void> {
  await mkdir(workspaceRoot, { recursive: true });
}

export async function writeZipArchive(
  workspaceRoot: string,
  sourceId: string,
  archive: Buffer,
): Promise<string> {
  const archivePath = zipArchivePath(workspaceRoot, sourceId);
  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(archivePath, archive);
  return archivePath;
}

export async function writeFolderFiles(
  workspaceRoot: string,
  sourceId: string,
  files: FolderUploadFile[],
): Promise<number> {
  const stagingDirectory = folderStagingDirectory(workspaceRoot, sourceId);
  await rm(stagingDirectory, { force: true, recursive: true });
  await mkdir(stagingDirectory, { recursive: true });

  let totalBytes = 0;
  for (const file of files) {
    const normalizedPath = normalizeRepositoryRelativePath(file.relativePath);
    const destinationPath = assertWorkspaceChild(stagingDirectory, normalizedPath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, file.buffer);
    totalBytes += file.buffer.byteLength;
  }

  return totalBytes;
}

export async function removeSourceStaging(workspaceRoot: string, sourceId: string): Promise<void> {
  await rm(path.join(workspaceRoot, "staging", sourceId), { force: true, recursive: true });
}
