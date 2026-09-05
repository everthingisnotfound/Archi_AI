import { z } from "zod";
import { passwordPolicy, repositoryLimitDefaults } from "./limits.js";
import { normalizeRepositoryRelativePath } from "./pathSafety.js";
import { parsePublicHttpUrl } from "./urlSafety.js";

export const idSchema = z.string().uuid();

export const emailSchema = z.string().trim().email().max(320).toLowerCase();

export const passwordSchema = z
  .string()
  .min(passwordPolicy.minLength, `Password must be at least ${passwordPolicy.minLength} characters.`)
  .max(passwordPolicy.maxLength, `Password must be at most ${passwordPolicy.maxLength} characters.`);

export const paginationSchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const registerRequestSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(160),
  password: passwordSchema,
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const websiteRepositoryRequestSchema = z.object({
  organizationId: idSchema,
  url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .superRefine((value, context) => {
      try {
        parsePublicHttpUrl(value);
      } catch (error) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: error instanceof Error ? error.message : "URL is not allowed.",
        });
      }
    }),
});

export const githubRepositoryRequestSchema = z.object({
  organizationId: idSchema,
  url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "github.com";
    }, "Only HTTPS GitHub repository URLs are allowed."),
});

export const folderManifestFileSchema = z.object({
  path: z.string().transform((value) => normalizeRepositoryRelativePath(value)),
  sizeBytes: z.coerce.number().int().min(0).max(repositoryLimitDefaults.maxSingleFileBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export const folderRepositoryRequestSchema = z.object({
  organizationId: idSchema,
  displayName: z.string().trim().min(1).max(180),
  files: z.array(folderManifestFileSchema).min(1).max(repositoryLimitDefaults.maxRepositoryFiles),
});

export const repositoryIdParamsSchema = z.object({
  repositoryId: idSchema,
});

export const organizationIdParamsSchema = z.object({
  organizationId: idSchema,
});

export const ingestionJobPayloadSchema = z.object({
  ingestionJobId: idSchema,
  organizationId: idSchema,
  repositoryId: idSchema,
});

export const analysisJobPayloadSchema = z.object({
  analysisRunId: idSchema,
  organizationId: idSchema,
  repositoryId: idSchema,
  snapshotId: idSchema,
});

export const enrichmentJobPayloadSchema = analysisJobPayloadSchema;
export const deepAnalysisJobPayloadSchema = analysisJobPayloadSchema;

export const snapshotFileDescriptorSchema = z.object({
  language: z.string().max(80).nullable().optional(),
  path: z.string().min(1).max(512),
  sizeBytes: z.number().int().min(0),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type GithubRepositoryRequest = z.infer<typeof githubRepositoryRequestSchema>;
export type WebsiteRepositoryRequest = z.infer<typeof websiteRepositoryRequestSchema>;
export type FolderRepositoryRequest = z.infer<typeof folderRepositoryRequestSchema>;
export type IngestionJobPayloadInput = z.infer<typeof ingestionJobPayloadSchema>;
export type AnalysisJobPayloadInput = z.infer<typeof analysisJobPayloadSchema>;
