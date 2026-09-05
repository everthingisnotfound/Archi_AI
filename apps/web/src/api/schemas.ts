import { z } from "zod";

export const membershipSchema = z.object({
  organizationId: z.string().uuid(),
  role: z.enum(["OWNER", "ADMIN", "ANALYST", "DEVELOPER", "VIEWER"]),
});

export const userSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});

export const authResponseSchema = z.object({
  memberships: z.array(membershipSchema),
  organization: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
    })
    .optional(),
  user: userSchema,
});

export const meResponseSchema = z.object({
  memberships: z.array(membershipSchema),
  user: userSchema.optional(),
});

export const repositorySchema = z.object({
  createdAt: z.string(),
  defaultBranch: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
  organizationId: z.string().uuid(),
  updatedAt: z.string(),
});

export const repositoryListSchema = z.object({
  items: z.array(repositorySchema),
  nextCursor: z.string().uuid().optional(),
});

export const ingestionJobSchema = z.object({
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  failureCode: z.string().nullable().optional(),
  failureMessage: z.string().nullable().optional(),
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  progress: z.number().optional(),
  repositoryId: z.string().uuid(),
  result: z.record(z.unknown()).nullable().optional(),
  sourceId: z.string().uuid().optional(),
  startedAt: z.string().nullable().optional(),
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"]),
});

export const analysisRunSchema = z.object({
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  repositoryId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  stage: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"]),
});

export const snapshotSchema = z.object({
  commitSha: z.string().nullable(),
  contentHash: z.string(),
  createdAt: z.string(),
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  repositoryId: z.string().uuid(),
});

export const fileNodeSchema = z.object({
  contentHash: z.string(),
  id: z.string().uuid(),
  language: z.string().nullable(),
  path: z.string(),
  sizeBytes: z.number(),
});

export const repositoryDetailSchema = z.object({
  latestAnalysisRun: analysisRunSchema.nullable().optional(),
  latestIngestionJob: ingestionJobSchema.nullable().optional(),
  latestSnapshot: snapshotSchema.nullable().optional(),
  repository: repositorySchema,
  sourceType: z.string().nullable().optional(),
  sourceUri: z.string().nullable().optional(),
});

export const graphSummarySchema = z.object({
  diagram: z
    .object({
      graphJson: z.record(z.unknown()),
      id: z.string().uuid(),
      title: z.string(),
      type: z.string(),
    })
    .nullable(),
  edgeCount: z.number(),
  metrics: z.array(
    z.object({
      key: z.string(),
      score: z.union([z.number(), z.string()]),
    }),
  ),
  symbolCount: z.number(),
});

export const ingestionJobResponseSchema = z.object({
  ingestionJob: ingestionJobSchema,
});

export const snapshotFilesSchema = z.object({
  items: z.array(fileNodeSchema),
  nextCursor: z.string().uuid().optional(),
});

export const documentSchema = z.object({
  contentMarkdown: z.string(),
  id: z.string().uuid(),
  title: z.string(),
  type: z.string(),
});

export const documentListSchema = z.object({
  items: z.array(documentSchema),
});

export const findingSchema = z.object({
  category: z.string(),
  description: z.string(),
  endLine: z.number().nullable().optional(),
  filePath: z.string().nullable().optional(),
  id: z.string().uuid(),
  metadata: z
    .object({
      path: z.string().optional(),
      remediation: z.string().optional(),
      riskExplanation: z.string().optional(),
    })
    .passthrough()
    .optional(),
  severity: z.string(),
  startLine: z.number().nullable().optional(),
  title: z.string(),
});

export const findingListSchema = z.object({
  items: z.array(findingSchema),
  nextCursor: z.string().uuid().optional(),
});

export const chatSessionResponseSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    repositoryId: z.string().uuid(),
    title: z.string().nullable(),
  }),
  snapshotId: z.string().uuid(),
});

export const chatMessageResponseSchema = z.object({
  assistantMessage: z.object({
    content: z.string(),
    id: z.string().uuid(),
    role: z.string(),
  }),
  retrievedChunkCount: z.number(),
  userMessage: z.object({
    content: z.string(),
    id: z.string().uuid(),
    role: z.string(),
  }),
});

export const repositoryCreateResponseSchema = z.object({
  ingestionJob: ingestionJobSchema,
  repository: repositorySchema,
  source: z.object({
    id: z.string().uuid(),
    type: z.string(),
  }),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
export type Repository = z.infer<typeof repositorySchema>;

