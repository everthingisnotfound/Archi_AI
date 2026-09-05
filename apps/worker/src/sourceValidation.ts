import { AppError, ErrorCode, parsePublicHttpUrl } from "@ai-archaeologist/shared";
import { z } from "zod";
import type { WorkerConfig } from "./config.js";

const zipMetadataSchema = z.object({
  originalName: z.string().min(1).max(255),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sizeBytes: z.number().int().min(1),
});

const folderMetadataSchema = z.object({
  fileCount: z.number().int().min(1),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/i),
  totalBytes: z.number().int().min(0),
});

export type SourceForValidation = {
  metadata: unknown;
  type: "GITHUB" | "ZIP" | "FOLDER" | "WEBSITE";
  uri: string | null;
};

export function validateRepositorySource(source: SourceForValidation, config: WorkerConfig): void {
  if (source.type === "GITHUB") {
    validateGithubSource(source.uri);
    return;
  }

  if (source.type === "WEBSITE") {
    if (!source.uri) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: "Website source URI is required.",
        statusCode: 400,
      });
    }
    try {
      parsePublicHttpUrl(source.uri);
    } catch (error) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: error instanceof Error ? error.message : "Website source URI is invalid.",
        statusCode: 400,
      });
    }
    return;
  }

  if (source.type === "ZIP") {
    const metadata = zipMetadataSchema.parse(source.metadata);
    if (metadata.sizeBytes > config.MAX_UPLOAD_BYTES) {
      throw new AppError({
        code: ErrorCode.InvalidInput,
        message: "ZIP source exceeds upload limits.",
        statusCode: 400,
      });
    }
    return;
  }

  const metadata = folderMetadataSchema.parse(source.metadata);
  if (metadata.fileCount > config.MAX_REPOSITORY_FILES || metadata.totalBytes > config.MAX_REPOSITORY_BYTES) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "Folder source exceeds repository limits.",
      statusCode: 400,
    });
  }
}

function validateGithubSource(uri: string | null): void {
  if (!uri) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "GitHub source URI is required.",
      statusCode: 400,
    });
  }

  const parsed = new URL(uri);
  const parts = parsed.pathname.split("/").filter(Boolean);

  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com" || parts.length < 2) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "GitHub source URI is invalid.",
      statusCode: 400,
    });
  }
}

