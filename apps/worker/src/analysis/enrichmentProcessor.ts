import { enrichmentJobPayloadSchema } from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { runEnrichment } from "../ai/enrichmentClient.js";
import type { WorkerConfig } from "../config.js";
import type { WorkerLogger } from "../logger.js";
import { persistEnrichment } from "./persistEnrichment.js";

export type EnrichmentProcessorDependencies = {
  config: WorkerConfig;
  logger: WorkerLogger;
  prisma: PrismaClient;
};

export function createEnrichmentProcessor(dependencies: EnrichmentProcessorDependencies) {
  return async (job: Job<unknown>): Promise<void> => {
    const payload = enrichmentJobPayloadSchema.parse(job.data);
    const analysisRun = await dependencies.prisma.analysisRun.findFirst({
      where: {
        id: payload.analysisRunId,
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
        snapshotId: payload.snapshotId,
      },
    });

    if (!analysisRun) {
      throw new Error(`Analysis run ${payload.analysisRunId} was not found.`);
    }

    if (analysisRun.status === "SUCCEEDED" && analysisRun.stage === "COMPLETED") {
      dependencies.logger.info({ analysisRunId: analysisRun.id }, "enrichment already completed");
      return;
    }

    await dependencies.prisma.analysisRun.update({
      data: {
        stage: "EMBEDDING",
        status: "RUNNING",
      },
      where: {
        id: analysisRun.id,
      },
    });

    try {
      const [repository, fileNodes, chunks, ingestionJob] = await Promise.all([
        dependencies.prisma.repository.findUnique({
          where: { id: payload.repositoryId },
        }),
        dependencies.prisma.fileNode.findMany({
          select: { id: true, language: true, path: true, sizeBytes: true },
          where: {
            organizationId: payload.organizationId,
            repositoryId: payload.repositoryId,
            snapshotId: payload.snapshotId,
          },
        }),
        dependencies.prisma.codeChunk.findMany({
          select: {
            fileNode: {
              select: {
                path: true,
              },
            },
            id: true,
            text: true,
          },
          take: 64,
          where: {
            organizationId: payload.organizationId,
            repositoryId: payload.repositoryId,
            snapshotId: payload.snapshotId,
          },
        }),
        dependencies.prisma.ingestionJob.findFirst({
          orderBy: { createdAt: "desc" },
          where: { repositoryId: payload.repositoryId, status: "SUCCEEDED" },
        }),
      ]);

      if (!repository) {
        throw new Error(`Repository ${payload.repositoryId} was not found.`);
      }

      const ingestionResult = ingestionJob?.result as
        | { languages?: string[]; technologies?: string[] }
        | null
        | undefined;

      await job.updateProgress(25);
      const result = await runEnrichment(dependencies.config, payload, {
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          path: chunk.fileNode.path,
          text: chunk.text,
        })),
        files: fileNodes.map((fileNode) => ({
          language: fileNode.language,
          path: fileNode.path,
          sizeBytes: fileNode.sizeBytes,
        })),
        languages: ingestionResult?.languages ?? [],
        repositoryName: repository.name,
        technologies: ingestionResult?.technologies ?? [],
      });

      await job.updateProgress(80);
      const fileNodesByPath = new Map(fileNodes.map((fileNode) => [fileNode.path, fileNode.id]));
      await persistEnrichment(dependencies.prisma, {
        analysisRunId: analysisRun.id,
        fileNodesByPath,
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
        result,
        snapshotId: payload.snapshotId,
      });

      await job.updateProgress(100);
      dependencies.logger.info(
        {
          analysisRunId: analysisRun.id,
          embeddedCount: result.embedded_count,
          findingCount: result.findings.length,
        },
        "enrichment completed",
      );
    } catch (error) {
      await dependencies.prisma.analysisRun.update({
        data: {
          completedAt: new Date(),
          stage: "FAILED",
          status: "FAILED",
        },
        where: {
          id: analysisRun.id,
        },
      });
      throw error;
    }
  };
}
