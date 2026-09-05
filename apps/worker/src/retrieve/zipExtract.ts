import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  AppError,
  ErrorCode,
  assertWorkspaceChild,
  normalizeRepositoryRelativePath,
  repositoryLimitDefaults,
  zipArchivePath,
} from "@ai-archaeologist/shared";
import yauzl from "yauzl";
import type { WorkerConfig } from "../config.js";

// yauzl Entry type includes uncompressedSize
interface ZipEntry {
  fileName: string;
  uncompressedSize: number;
}

export async function extractZipArchive(
  workspaceRoot: string,
  sourceId: string,
  targetDirectory: string,
  config: WorkerConfig,
): Promise<void> {
  const archivePath = zipArchivePath(workspaceRoot, sourceId);
  await mkdir(targetDirectory, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(
          new AppError({
            code: ErrorCode.InvalidInput,
            message: "ZIP archive could not be opened.",
            statusCode: 400,
          }),
        );
        return;
      }

      let extractedFiles = 0;
      let extractedBytes = 0;

      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        try {
          if (entry.fileName.endsWith("/")) {
            zipFile.readEntry();
            return;
          }

          const normalizedEntryPath = normalizeRepositoryRelativePath(entry.fileName);
          const destinationPath = assertWorkspaceChild(targetDirectory, normalizedEntryPath);
          const depth = normalizedEntryPath.split("/").length;
          if (depth > repositoryLimitDefaults.maxArchiveDepth) {
            throw new AppError({
              code: ErrorCode.InvalidInput,
              message: "ZIP archive exceeds allowed path depth.",
              statusCode: 400,
            });
          }

          const zipEntry = entry as ZipEntry;
          extractedFiles += 1;
          extractedBytes += zipEntry.uncompressedSize;
          if (
            extractedFiles > config.MAX_REPOSITORY_FILES ||
            extractedBytes > config.MAX_REPOSITORY_BYTES
          ) {
            throw new AppError({
              code: ErrorCode.InvalidInput,
              message: "ZIP archive exceeds repository limits.",
              statusCode: 400,
            });
          }

          zipFile.openReadStream(entry, (streamError, readStream) => {
            if (streamError) {
              reject(new Error(streamError.message));
              return;
            }
            if (!readStream) {
              reject(new Error("Could not open ZIP entry read stream."));
              return;
            }

            void (async () => {
              await mkdir(path.dirname(destinationPath), { recursive: true });
              await pipelineToFile(readStream, destinationPath);
              zipFile.readEntry();
            })();
          });
        } catch (err) {
          zipFile.close();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      zipFile.on("end", () => {
        zipFile.close();
        resolve();
      });
      zipFile.on("error", (error) => {
        zipFile.close();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  });
}

function pipelineToFile(readStream: NodeJS.ReadableStream, destinationPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(destinationPath);
    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    readStream.pipe(writeStream);
  });
}
