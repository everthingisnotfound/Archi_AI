import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  AppError,
  ErrorCode,
  detectLanguageFromPath,
  detectTechnologiesFromPaths,
  shouldExcludeRepositoryPath,
} from "@ai-archaeologist/shared";
import type { WorkerConfig } from "../config.js";

export type ScannedRepositoryFile = {
  contentHash: string;
  language?: string | undefined;
  path: string;
  sizeBytes: number;
};

export type RepositoryScanResult = {
  contentHash: string;
  fileCount: number;
  files: ScannedRepositoryFile[];
  languages: string[];
  technologies: string[];
  totalBytes: number;
};

const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mp3",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
]);

export async function scanRepositoryDirectory(
  repositoryRoot: string,
  config: WorkerConfig,
): Promise<RepositoryScanResult> {
  const files: ScannedRepositoryFile[] = [];

  await walkDirectory(repositoryRoot, repositoryRoot, files, config);

  if (files.length === 0) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Repository does not contain any analyzable files.",
      statusCode: 400,
    });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  const languages = [...new Set(files.map((file) => file.language).filter(Boolean) as string[])].sort();
  const technologies = detectTechnologiesFromPaths(files.map((file) => file.path));
  const contentHash = createHash("sha256")
    .update(
      files
        .slice()
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((file) => `${file.path}:${file.contentHash}`)
        .join("\n"),
    )
    .digest("hex");

  return {
    contentHash,
    fileCount: files.length,
    files,
    languages,
    technologies,
    totalBytes,
  };
}

async function walkDirectory(
  repositoryRoot: string,
  currentDirectory: string,
  files: ScannedRepositoryFile[],
  config: WorkerConfig,
): Promise<void> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  let totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(repositoryRoot, absolutePath).replaceAll("\\", "/");

    if (shouldExcludeRepositoryPath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkDirectory(repositoryRoot, absolutePath, files, config);
      totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    if (fileStat.size > config.MAX_SINGLE_FILE_BYTES) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: `File ${relativePath} exceeds the single-file limit.`,
        statusCode: 400,
      });
    }

    if (files.length + 1 > config.MAX_REPOSITORY_FILES || totalBytes + fileStat.size > config.MAX_REPOSITORY_BYTES) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: "Repository exceeds configured file or size limits.",
        statusCode: 400,
      });
    }

    const extension = path.extname(relativePath).toLowerCase();
    const content = binaryExtensions.has(extension) ? Buffer.alloc(0) : await readFile(absolutePath);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const language = detectLanguageFromPath(relativePath);

    files.push({
      contentHash,
      ...(language ? { language } : {}),
      path: relativePath,
      sizeBytes: fileStat.size,
    });
    totalBytes += fileStat.size;
  }
}
