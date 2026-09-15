import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
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

interface YauzlEntry {
  fileName: string;
  uncompressedSize: number;
}

interface YauzlZipFile {
  readEntry(): void;
  close(): void;

  openReadStream(
    entry: YauzlEntry,
    callback: (error: Error | null, stream: Readable) => void,
  ): void;

  on(event: "entry", listener: (entry: YauzlEntry) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

interface YauzlApi {
  open(
    path: string,
    options: {
      lazyEntries: boolean;
      validateEntrySizes: boolean;
    },
    callback: (
      error: Error | null,
      zipFile: YauzlZipFile,
    ) => void,
  ): void;
}

/*
 * The installed yauzl package is currently being resolved as `any`
 * by this project. Keep that unsafely-typed boundary isolated here.
 *
 * Everything after this point is strongly typed.
 */
const yauzlApi = yauzl as unknown as YauzlApi;

export async function extractZipArchive(
  workspaceRoot: string,
  sourceId: string,
  targetDirectory: string,
  config: WorkerConfig,
): Promise<void> {
  const archivePath = zipArchivePath(workspaceRoot, sourceId);

  await mkdir(targetDirectory, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const fail = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;

      reject(
        error instanceof Error
          ? error
          : new Error(String(error)),
      );
    };

    const succeed = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    yauzlApi.open(
      archivePath,
      {
        lazyEntries: true,
        validateEntrySizes: true,
      },
      (openError, zipFile) => {
        if (openError) {
          fail(
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

        zipFile.on("entry", (entry) => {
          try {
            if (entry.fileName.endsWith("/")) {
              zipFile.readEntry();
              return;
            }

            const normalizedEntryPath =
              normalizeRepositoryRelativePath(entry.fileName);

            const destinationPath = assertWorkspaceChild(
              targetDirectory,
              normalizedEntryPath,
            );

            const depth = normalizedEntryPath.split("/").length;

            if (
              depth > repositoryLimitDefaults.maxArchiveDepth
            ) {
              throw new AppError({
                code: ErrorCode.InvalidInput,
                message: "ZIP archive exceeds allowed path depth.",
                statusCode: 400,
              });
            }

            extractedFiles += 1;
            extractedBytes += entry.uncompressedSize;

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

            zipFile.openReadStream(
              entry,
              (streamError, readStream) => {
                if (streamError) {
                  try {
                    zipFile.close();
                  } catch {
                    // The ZIP may already be closed.
                  }

                  fail(streamError);
                  return;
                }

                void writeZipEntry(
                  readStream,
                  destinationPath,
                )
                  .then(() => {
                    if (!settled) {
                      zipFile.readEntry();
                    }
                  })
                  .catch((error: unknown) => {
                    try {
                      zipFile.close();
                    } catch {
                      // The ZIP may already be closed.
                    }

                    fail(error);
                  });
              },
            );
          } catch (error: unknown) {
            try {
              zipFile.close();
            } catch {
              // The ZIP may already be closed.
            }

            fail(error);
          }
        });

        zipFile.on("end", () => {
          try {
            zipFile.close();
          } catch {
            // The ZIP may already be closed.
          }

          succeed();
        });

        zipFile.on("error", (error) => {
          try {
            zipFile.close();
          } catch {
            // The ZIP may already be closed.
          }

          fail(error);
        });

        zipFile.readEntry();
      },
    );
  });
}

async function writeZipEntry(
  readStream: Readable,
  destinationPath: string,
): Promise<void> {
  await mkdir(path.dirname(destinationPath), {
    recursive: true,
  });

  await new Promise<void>((resolve, reject) => {
    const writeStream = createWriteStream(destinationPath);

    let settled = false;

    const fail = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      writeStream.destroy();

      reject(
        error instanceof Error
          ? error
          : new Error(String(error)),
      );
    };

    const succeed = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    readStream.once("error", fail);
    writeStream.once("error", fail);
    writeStream.once("finish", succeed);

    readStream.pipe(writeStream);
  });
}