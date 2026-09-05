import { rm } from "node:fs/promises";
import { ingestionJobPayloadSchema, repositoryDirectoryInJob, sourceStagingDirectory } from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import type { WorkerConfig } from "./config.js";
import type { WorkerLogger } from "./logger.js";
import { copyFolderStaging } from "./retrieve/folderCopy.js";
import { cloneGithubRepository } from "./retrieve/githubClone.js";
import { crawlPublicWebsite } from "./retrieve/websiteCrawl.js";
import { extractZipArchive } from "./retrieve/zipExtract.js";
import { scanRepositoryDirectory } from "./scan/repositoryScan.js";
import { persistRepositorySnapshot } from "./snapshot/persistSnapshot.js";
import { persistSnapshotWorkspace } from "./snapshot/persistSnapshotWorkspace.js";
import { validateRepositorySource } from "./sourceValidation.js";
import type { AnalysisJobPublisher } from "./jobs/analysisJobPublisher.js";
import { removeJobWorkspace, resetJobWorkspace } from "./workspace/cleanup.js";

export type IngestionProcessorDependencies = {
  analysisJobPublisher: AnalysisJobPublisher;
  config: WorkerConfig;
  logger: WorkerLogger;
  prisma: PrismaClient;
};

export function createIngestionProcessor(dependencies: IngestionProcessorDependencies) {
  return async (job: Job<unknown>): Promise<void> => {
    const payload = ingestionJobPayloadSchema.parse(job.data);
    const ingestionJob = await dependencies.prisma.ingestionJob.findFirst({
      include: {
        source: true,
      },
      where: {
        id: payload.ingestionJobId,
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
      },
    });

    if (!ingestionJob) {
      throw new Error(`Ingestion job ${payload.ingestionJobId} was not found.`);
    }

    if (ingestionJob.status === "SUCCEEDED") {
      dependencies.logger.info({ ingestionJobId: ingestionJob.id }, "ingestion job already completed");
      return;
    }

    await dependencies.prisma.ingestionJob.update({
      data: {
        failureCode: null,
        failureMessage: null,
        progress: 5,
        startedAt: ingestionJob.startedAt ?? new Date(),
        status: "RUNNING",
      },
      where: {
        id: ingestionJob.id,
      },
    });

    try {
      validateRepositorySource(
        {
          metadata: ingestionJob.source.metadata,
          type: ingestionJob.source.type,
          uri: ingestionJob.source.uri,
        },
        dependencies.config,
      );

      const jobWorkspace = await resetJobWorkspace(
        dependencies.config.WORKSPACE_ROOT,
        ingestionJob.id,
      );
      const repositoryRoot = repositoryDirectoryInJob(jobWorkspace);
      let commitSha: string | undefined;
      let defaultBranch: string | undefined;

      await job.updateProgress(20);
      if (ingestionJob.source.type === "GITHUB") {
        const cloneResult = await cloneGithubRepository(ingestionJob.source.uri ?? "", repositoryRoot, {
          depth: dependencies.config.GITHUB_CLONE_DEPTH,
          timeoutMs: dependencies.config.GITHUB_CLONE_TIMEOUT_MS,
        });
        commitSha = cloneResult.commitSha;
        defaultBranch = cloneResult.defaultBranch;
      } else if (ingestionJob.source.type === "WEBSITE") {
        await crawlPublicWebsite(ingestionJob.source.uri ?? "", repositoryRoot);
        defaultBranch = "live";
      } else if (ingestionJob.source.type === "ZIP") {
        await extractZipArchive(
          dependencies.config.WORKSPACE_ROOT,
          ingestionJob.source.id,
          repositoryRoot,
          dependencies.config,
        );
      } else {
        await copyFolderStaging(
          dependencies.config.WORKSPACE_ROOT,
          ingestionJob.source.id,
          repositoryRoot,
          dependencies.config,
        );
      }

      await job.updateProgress(60);
      const scan = await scanRepositoryDirectory(repositoryRoot, dependencies.config);
      const { snapshotId } = await persistRepositorySnapshot(dependencies.prisma, {
        ...(commitSha ? { commitSha } : {}),
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
        scan,
      });

      if (defaultBranch) {
        await dependencies.prisma.repository.update({
          data: {
            defaultBranch,
          },
          where: {
            id: payload.repositoryId,
          },
        });
      }

      await persistSnapshotWorkspace(dependencies.config.WORKSPACE_ROOT, snapshotId, repositoryRoot);

      const analysisRun = await dependencies.prisma.analysisRun.create({
        data: {
          organizationId: payload.organizationId,
          repositoryId: payload.repositoryId,
          snapshotId,
          stage: "PARSING",
          status: "QUEUED",
        },
      });

      await dependencies.analysisJobPublisher.enqueueAnalysis({
        analysisRunId: analysisRun.id,
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
        snapshotId,
      });

      await job.updateProgress(100);
      await dependencies.prisma.ingestionJob.update({
        data: {
          completedAt: new Date(),
          progress: 100,
          result: {
            analysisRunId: analysisRun.id,
            fileCount: scan.fileCount,
            languages: scan.languages,
            snapshotId,
            stage: "ingested",
            technologies: scan.technologies,
            totalBytes: scan.totalBytes,
          },
          status: "SUCCEEDED",
        },
        where: {
          id: ingestionJob.id,
        },
      });

      await removeSourceStaging(dependencies.config.WORKSPACE_ROOT, ingestionJob.source.id);
      await removeJobWorkspace(dependencies.config.WORKSPACE_ROOT, ingestionJob.id);
      dependencies.logger.info(
        { ingestionJobId: ingestionJob.id, snapshotId },
        "repository ingested and snapshot created",
      );
    } catch (error) {
      await dependencies.prisma.ingestionJob.update({
        data: {
          completedAt: new Date(),
          failureCode: "INGESTION_FAILED",
          failureMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown failure",
          status: "FAILED",
        },
        where: {
          id: ingestionJob.id,
        },
      });
      throw error;
    }
  };
}

async function removeSourceStaging(workspaceRoot: string, sourceId: string): Promise<void> {
  await rm(sourceStagingDirectory(workspaceRoot, sourceId), { force: true, recursive: true });
}
