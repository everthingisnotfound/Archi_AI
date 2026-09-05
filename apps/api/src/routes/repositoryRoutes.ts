import { createHash } from "node:crypto";
import {
  AppError,
  ErrorCode,
  folderRepositoryRequestSchema,
  normalizeRepositoryRelativePath,
  paginationSchema,
  parsePublicHttpUrl,
  repositoryIdParamsSchema,
  repositoryNameFromWebsiteUrl,
  websiteRepositoryRequestSchema,
} from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { assertOrganizationRole } from "../auth/rbac.js";
import type { ApiConfig } from "../config.js";
import { recordAuditEvent } from "../audit/auditLog.js";
import { asyncHandler } from "../http/asyncHandler.js";
import type { JobPublisher } from "../jobs/jobPublisher.js";
import {
  loadIngestionJobForRepository,
  loadRepositoryForOrganization,
  loadSnapshotForRepository,
} from "../repositories/repositoryAccess.js";
import {
  ensureWorkspaceRoot,
  writeFolderFiles,
  writeZipArchive,
} from "../staging/stagingStorage.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

const ingestionJobParamsSchema = repositoryIdParamsSchema.extend({
  jobId: z.string().uuid(),
});

const snapshotParamsSchema = repositoryIdParamsSchema.extend({
  snapshotId: z.string().uuid(),
});

const githubBodySchema = z.object({
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

const folderDisplayNameSchema = z.string().trim().min(1).max(180);

function repositoryNameFromGithubUrl(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const repositoryName = parts.at(1)?.replace(/\.git$/i, "");

  if (!parts.at(0) || !repositoryName) {
    throw new AppError({
      code: ErrorCode.InvalidInput,
      message: "GitHub URL must include an owner and repository name.",
      statusCode: 400,
    });
  }

  return repositoryName.slice(0, 180);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function conflictIfDuplicateName(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError({
      code: ErrorCode.Conflict,
      message: `A source named "${name}" already exists in this workspace. Open it from the list instead of adding it again.`,
      statusCode: 409,
    });
  }
  throw error;
}

function parseMultipartPaths(input: unknown): string[] {
  if (typeof input === "string") {
    return [input];
  }

  if (Array.isArray(input)) {
    return input.map(String);
  }

  throw new AppError({
    code: ErrorCode.InvalidInput,
    message: "Folder upload paths are required.",
    statusCode: 400,
  });
}

export function createRepositoryRouter(
  prisma: PrismaClient,
  config: ApiConfig,
  jobPublisher: JobPublisher,
): Router {
  const router = Router();
  const zipUpload = multer({
    limits: {
      fileSize: config.MAX_UPLOAD_BYTES,
      files: 1,
    },
    storage: multer.memoryStorage(),
  });
  const folderUpload = multer({
    limits: {
      fileSize: config.MAX_SINGLE_FILE_BYTES,
      files: config.MAX_REPOSITORY_FILES,
    },
    storage: multer.memoryStorage(),
  });

  router.get(
    "/organizations/:organizationId/repositories",
    asyncHandler(async (request, response) => {
      const params = organizationParamsSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);
      assertOrganizationRole(request.auth, params.organizationId, "VIEWER");

      const repositories = await prisma.repository.findMany({
        ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
        orderBy: {
          createdAt: "desc",
        },
        take: query.limit,
        where: {
          organizationId: params.organizationId,
        },
      });

      response.json({
        items: repositories,
        nextCursor: repositories.length === query.limit ? repositories.at(-1)?.id : undefined,
      });
    }),
  );

  router.get(
    "/repositories/:repositoryId",
    asyncHandler(async (request, response) => {
      const params = repositoryIdParamsSchema.parse(request.params);
      const repository = await loadRepositoryForOrganization(
        prisma,
        request.auth,
        params.repositoryId,
        "VIEWER",
      );

      const [latestJob, latestSnapshot, latestAnalysisRun, latestSource] = await Promise.all([
        prisma.ingestionJob.findFirst({
          orderBy: {
            createdAt: "desc",
          },
          where: {
            repositoryId: repository.id,
          },
        }),
        prisma.repositorySnapshot.findFirst({
          orderBy: {
            createdAt: "desc",
          },
          where: {
            repositoryId: repository.id,
          },
        }),
        prisma.analysisRun.findFirst({
          orderBy: {
            createdAt: "desc",
          },
          where: {
            repositoryId: repository.id,
          },
        }),
        prisma.repositorySource.findFirst({
          orderBy: {
            createdAt: "desc",
          },
          where: {
            repositoryId: repository.id,
          },
        }),
      ]);

      response.json({
        latestAnalysisRun,
        latestIngestionJob: latestJob,
        latestSnapshot,
        repository,
        sourceType: latestSource?.type ?? null,
        sourceUri: latestSource?.uri ?? null,
      });
    }),
  );

  router.get(
    "/repositories/:repositoryId/jobs/:jobId",
    asyncHandler(async (request, response) => {
      const params = ingestionJobParamsSchema.parse(request.params);
      const ingestionJob = await loadIngestionJobForRepository(
        prisma,
        request.auth,
        params.repositoryId,
        params.jobId,
        "VIEWER",
      );

      response.json({ ingestionJob });
    }),
  );

  router.get(
    "/repositories/:repositoryId/snapshots/:snapshotId/files",
    asyncHandler(async (request, response) => {
      const params = snapshotParamsSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);
      await loadSnapshotForRepository(
        prisma,
        request.auth,
        params.repositoryId,
        params.snapshotId,
        "VIEWER",
      );

      const files = await prisma.fileNode.findMany({
        ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
        orderBy: {
          path: "asc",
        },
        select: {
          contentHash: true,
          id: true,
          language: true,
          path: true,
          sizeBytes: true,
        },
        take: query.limit,
        where: {
          repositoryId: params.repositoryId,
          snapshotId: params.snapshotId,
        },
      });

      response.json({
        items: files,
        nextCursor: files.length === query.limit ? files.at(-1)?.id : undefined,
      });
    }),
  );

  router.get(
    "/repositories/:repositoryId/snapshots/:snapshotId/graph",
    asyncHandler(async (request, response) => {
      const params = snapshotParamsSchema.parse(request.params);
      await loadSnapshotForRepository(
        prisma,
        request.auth,
        params.repositoryId,
        params.snapshotId,
        "VIEWER",
      );

      const [diagram, metrics, symbolCount, edgeCount] = await Promise.all([
        prisma.diagram.findFirst({
          where: {
            repositoryId: params.repositoryId,
            snapshotId: params.snapshotId,
            type: "DEPENDENCY_GRAPH",
          },
        }),
        prisma.metric.findMany({
          where: {
            repositoryId: params.repositoryId,
            snapshotId: params.snapshotId,
          },
        }),
        prisma.symbol.count({
          where: {
            repositoryId: params.repositoryId,
            snapshotId: params.snapshotId,
          },
        }),
        prisma.dependencyEdge.count({
          where: {
            repositoryId: params.repositoryId,
            snapshotId: params.snapshotId,
          },
        }),
      ]);

      response.json({
        diagram,
        edgeCount,
        metrics,
        symbolCount,
      });
    }),
  );

  router.get(
    "/repositories/:repositoryId/snapshots/:snapshotId/documents",
    asyncHandler(async (request, response) => {
      const params = snapshotParamsSchema.parse(request.params);
      await loadSnapshotForRepository(
        prisma,
        request.auth,
        params.repositoryId,
        params.snapshotId,
        "VIEWER",
      );

      const documents = await prisma.document.findMany({
        orderBy: {
          createdAt: "desc",
        },
        where: {
          repositoryId: params.repositoryId,
          snapshotId: params.snapshotId,
        },
      });

      response.json({ items: documents });
    }),
  );

  router.get(
    "/repositories/:repositoryId/snapshots/:snapshotId/findings",
    asyncHandler(async (request, response) => {
      const params = snapshotParamsSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);
      await loadSnapshotForRepository(
        prisma,
        request.auth,
        params.repositoryId,
        params.snapshotId,
        "VIEWER",
      );

      const findings = await prisma.finding.findMany({
        ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
        include: {
          fileNode: {
            select: {
              path: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: query.limit,
        where: {
          repositoryId: params.repositoryId,
          snapshotId: params.snapshotId,
        },
      });

      response.json({
        items: findings.map((finding) => ({
          category: finding.category,
          description: finding.description,
          endLine: finding.endLine,
          filePath:
            finding.fileNode?.path ??
            (typeof finding.metadata === "object" &&
            finding.metadata !== null &&
            "path" in finding.metadata &&
            typeof finding.metadata.path === "string"
              ? finding.metadata.path
              : null),
          id: finding.id,
          metadata: finding.metadata,
          severity: finding.severity,
          startLine: finding.startLine,
          title: finding.title,
        })),
        nextCursor: findings.length === query.limit ? findings.at(-1)?.id : undefined,
      });
    }),
  );

  router.post(
    "/organizations/:organizationId/repositories/github",
    asyncHandler(async (request, response) => {
      const params = organizationParamsSchema.parse(request.params);
      const body = githubBodySchema.parse(request.body);
      assertOrganizationRole(request.auth, params.organizationId, "DEVELOPER");

      const repositoryName = repositoryNameFromGithubUrl(body.url);
      let result: { ingestionJob: { id: string }; repository: { id: string }; source: { id: string } };
      try {
        result = await prisma.$transaction(async (transaction) => {
        const repository = await transaction.repository.create({
          data: {
            name: repositoryName,
            organizationId: params.organizationId,
          },
        });
        const source = await transaction.repositorySource.create({
          data: {
            metadata: {
              normalizedUrl: body.url,
            },
            organizationId: params.organizationId,
            repositoryId: repository.id,
            type: "GITHUB",
            uri: body.url,
          },
        });
        const ingestionJob = await transaction.ingestionJob.create({
          data: {
            organizationId: params.organizationId,
            repositoryId: repository.id,
            sourceId: source.id,
          },
        });
        return { ingestionJob, repository, source };
      });
      } catch (error) {
        conflictIfDuplicateName(error, repositoryName);
      }

      await jobPublisher.enqueueIngestion({
        ingestionJobId: result.ingestionJob.id,
        organizationId: params.organizationId,
        repositoryId: result.repository.id,
      });
      await recordAuditEvent(prisma, request, {
        action: "repository.source.github.create",
        organizationId: params.organizationId,
        resourceId: result.repository.id,
        resourceType: "Repository",
        userId: request.auth?.user.id,
      });

      response.status(202).json(result);
    }),
  );

  router.post(
    "/organizations/:organizationId/repositories/website",
    asyncHandler(async (request, response) => {
      const params = organizationParamsSchema.parse(request.params);
      const body = websiteRepositoryRequestSchema.omit({ organizationId: true }).parse(request.body);
      parsePublicHttpUrl(body.url);
      assertOrganizationRole(request.auth, params.organizationId, "DEVELOPER");

      const repositoryName = repositoryNameFromWebsiteUrl(body.url);
      const result = await prisma.$transaction(async (transaction) => {
        const repository = await transaction.repository.create({
          data: {
            defaultBranch: "live",
            name: repositoryName,
            organizationId: params.organizationId,
          },
        });
        const source = await transaction.repositorySource.create({
          data: {
            metadata: {
              normalizedUrl: body.url,
            },
            organizationId: params.organizationId,
            repositoryId: repository.id,
            type: "WEBSITE",
            uri: body.url,
          },
        });
        const ingestionJob = await transaction.ingestionJob.create({
          data: {
            organizationId: params.organizationId,
            repositoryId: repository.id,
            sourceId: source.id,
          },
        });
        return { ingestionJob, repository, source };
      });

      await jobPublisher.enqueueIngestion({
        ingestionJobId: result.ingestionJob.id,
        organizationId: params.organizationId,
        repositoryId: result.repository.id,
      });
      await recordAuditEvent(prisma, request, {
        action: "repository.source.website.create",
        organizationId: params.organizationId,
        resourceId: result.repository.id,
        resourceType: "Repository",
        userId: request.auth?.user.id,
      });

      response.status(202).json(result);
    }),
  );

  router.post(
    "/repositories/:repositoryId/deep-analysis",
    asyncHandler(async (request, response) => {
      const params = repositoryIdParamsSchema.parse(request.params);
      const repository = await loadRepositoryForOrganization(
        prisma,
        request.auth,
        params.repositoryId,
        "DEVELOPER",
      );

      const snapshot = await prisma.repositorySnapshot.findFirst({
        orderBy: { createdAt: "desc" },
        where: { repositoryId: repository.id },
      });
      const analysisRun = await prisma.analysisRun.findFirst({
        orderBy: { createdAt: "desc" },
        where: { repositoryId: repository.id, status: "SUCCEEDED" },
      });

      if (!snapshot || !analysisRun) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "Deeper analysis is available after ingestion and analysis succeed.",
          statusCode: 400,
        });
      }

      await jobPublisher.enqueueDeepAnalysis({
        analysisRunId: analysisRun.id,
        organizationId: repository.organizationId,
        repositoryId: repository.id,
        snapshotId: snapshot.id,
      });
      await recordAuditEvent(prisma, request, {
        action: "repository.deep-analysis.enqueue",
        organizationId: repository.organizationId,
        resourceId: repository.id,
        resourceType: "Repository",
        userId: request.auth?.user.id,
      });

      response.status(202).json({
        queued: true,
        snapshotId: snapshot.id,
      });
    }),
  );

  router.post(
    "/repositories/:repositoryId/analysis/retry",
    asyncHandler(async (request, response) => {
      const params = repositoryIdParamsSchema.parse(request.params);
      const repository = await loadRepositoryForOrganization(
        prisma,
        request.auth,
        params.repositoryId,
        "DEVELOPER",
      );

      const analysisRun = await prisma.analysisRun.findFirst({
        orderBy: { createdAt: "desc" },
        where: { repositoryId: repository.id },
      });

      if (!analysisRun) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "No analysis run exists to retry.",
          statusCode: 400,
        });
      }

      await prisma.analysisRun.update({
        data: {
          completedAt: null,
          stage: "PARSING",
          status: "QUEUED",
        },
        where: { id: analysisRun.id },
      });

      await jobPublisher.enqueueAnalysis({
        analysisRunId: analysisRun.id,
        organizationId: repository.organizationId,
        repositoryId: repository.id,
        snapshotId: analysisRun.snapshotId,
      });
      await recordAuditEvent(prisma, request, {
        action: "repository.analysis.retry",
        organizationId: repository.organizationId,
        resourceId: analysisRun.id,
        resourceType: "AnalysisRun",
        userId: request.auth?.user.id,
      });

      response.status(202).json({
        analysisRunId: analysisRun.id,
        queued: true,
      });
    }),
  );

  router.post(
    "/organizations/:organizationId/repositories/folder",
    folderUpload.array("files"),
    asyncHandler(async (request, response) => {
      const params = organizationParamsSchema.parse(request.params);
      assertOrganizationRole(request.auth, params.organizationId, "DEVELOPER");

      const displayName = folderDisplayNameSchema.parse(request.body.displayName);
      const uploadedFiles = request.files;
      const paths = parseMultipartPaths(request.body.paths);

      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "Folder upload requires at least one file.",
          statusCode: 400,
        });
      }

      if (uploadedFiles.length !== paths.length) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "Folder upload file and path counts must match.",
          statusCode: 400,
        });
      }

      const files = uploadedFiles.map((file, index) => ({
        path: normalizeRepositoryRelativePath(paths[index] ?? file.originalname),
        sizeBytes: file.size,
      }));

      const manifest = folderRepositoryRequestSchema.parse({
        displayName,
        files,
        organizationId: params.organizationId,
      });
      const totalBytes = manifest.files.reduce((sum, file) => sum + file.sizeBytes, 0);

      const result = await prisma.$transaction(async (transaction) => {
        const repository = await transaction.repository.create({
          data: {
            name: manifest.displayName,
            organizationId: params.organizationId,
          },
        });
        const source = await transaction.repositorySource.create({
          data: {
            metadata: {
              fileCount: manifest.files.length,
              manifestHash: sha256(Buffer.from(JSON.stringify(manifest.files))),
              totalBytes,
            },
            organizationId: params.organizationId,
            repositoryId: repository.id,
            type: "FOLDER",
          },
        });
        const ingestionJob = await transaction.ingestionJob.create({
          data: {
            organizationId: params.organizationId,
            repositoryId: repository.id,
            sourceId: source.id,
          },
        });
        return { ingestionJob, repository, source };
      });

      await ensureWorkspaceRoot(config.WORKSPACE_ROOT);
      await writeFolderFiles(
        config.WORKSPACE_ROOT,
        result.source.id,
        uploadedFiles.map((file, index) => ({
          buffer: file.buffer,
          relativePath: paths[index] ?? file.originalname,
        })),
      );

      await jobPublisher.enqueueIngestion({
        ingestionJobId: result.ingestionJob.id,
        organizationId: params.organizationId,
        repositoryId: result.repository.id,
      });
      await recordAuditEvent(prisma, request, {
        action: "repository.source.folder.create",
        organizationId: params.organizationId,
        resourceId: result.repository.id,
        resourceType: "Repository",
        userId: request.auth?.user.id,
      });

      response.status(202).json(result);
    }),
  );

  router.post(
    "/organizations/:organizationId/repositories/zip",
    zipUpload.single("archive"),
    asyncHandler(async (request, response) => {
      const params = organizationParamsSchema.parse(request.params);
      assertOrganizationRole(request.auth, params.organizationId, "DEVELOPER");

      if (!request.file) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "ZIP archive is required.",
          statusCode: 400,
        });
      }

      const archive = request.file;
      const originalName = archive.originalname.replace(/\.zip$/i, "").slice(0, 180);
      const result = await prisma.$transaction(async (transaction) => {
        const repository = await transaction.repository.create({
          data: {
            name: originalName || "uploaded-repository",
            organizationId: params.organizationId,
          },
        });
        const source = await transaction.repositorySource.create({
          data: {
            metadata: {
              originalName: archive.originalname,
              sha256: sha256(archive.buffer),
              sizeBytes: archive.size,
              stored: true,
            },
            organizationId: params.organizationId,
            repositoryId: repository.id,
            type: "ZIP",
          },
        });
        const ingestionJob = await transaction.ingestionJob.create({
          data: {
            organizationId: params.organizationId,
            repositoryId: repository.id,
            sourceId: source.id,
          },
        });
        return { ingestionJob, repository, source };
      });

      await ensureWorkspaceRoot(config.WORKSPACE_ROOT);
      await writeZipArchive(config.WORKSPACE_ROOT, result.source.id, archive.buffer);

      await jobPublisher.enqueueIngestion({
        ingestionJobId: result.ingestionJob.id,
        organizationId: params.organizationId,
        repositoryId: result.repository.id,
      });
      await recordAuditEvent(prisma, request, {
        action: "repository.source.zip.create",
        organizationId: params.organizationId,
        resourceId: result.repository.id,
        resourceType: "Repository",
        userId: request.auth?.user.id,
      });

      response.status(202).json(result);
    }),
  );

  return router;
}
