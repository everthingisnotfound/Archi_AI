import { analysisJobPayloadSchema } from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { runStaticAnalysis } from "../ai/aiServiceClient.js";
import type { WorkerConfig } from "../config.js";
import type { WorkerLogger } from "../logger.js";
import type { EnrichmentJobPublisher } from "../jobs/enrichmentJobPublisher.js";
import { persistStaticAnalysis } from "./persistAnalysis.js";

export type AnalysisProcessorDependencies = {
  config: WorkerConfig;
  enrichmentJobPublisher: EnrichmentJobPublisher;
  logger: WorkerLogger;
  prisma: PrismaClient;
};

export function createAnalysisProcessor(dependencies: AnalysisProcessorDependencies) {
  return async (job: Job<unknown>): Promise<void> => {
    const payload = analysisJobPayloadSchema.parse(job.data);
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

    if (analysisRun.status === "SUCCEEDED") {
      dependencies.logger.info({ analysisRunId: analysisRun.id }, "analysis run already completed");
      return;
    }

    if (analysisRun.status === "FAILED") {
      dependencies.logger.info({ analysisRunId: analysisRun.id }, "retrying failed analysis run");
    }

    await dependencies.prisma.analysisRun.update({
      data: {
        stage: "PARSING",
        status: "RUNNING",
      },
      where: {
        id: analysisRun.id,
      },
    });

    try {
      const fileNodes = await dependencies.prisma.fileNode.findMany({
        select: {
          id: true,
          language: true,
          path: true,
          sizeBytes: true,
        },
        where: {
          organizationId: payload.organizationId,
          repositoryId: payload.repositoryId,
          snapshotId: payload.snapshotId,
        },
      });

      await job.updateProgress(20);
      const result = await runStaticAnalysis(
        dependencies.config,
        payload,
        fileNodes.map((fileNode) => ({
          language: fileNode.language,
          path: fileNode.path,
          sizeBytes: fileNode.sizeBytes,
        })),
      );

      await job.updateProgress(80);
      const fileNodesByPath = new Map(fileNodes.map((fileNode) => [fileNode.path, fileNode.id]));

      await persistStaticAnalysis(dependencies.prisma, {
        analysisRunId: analysisRun.id,
        fileNodesByPath,
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
        result,
        snapshotId: payload.snapshotId,
      });

      await dependencies.enrichmentJobPublisher.enqueueEnrichment({
        analysisRunId: analysisRun.id,
        organizationId: payload.organizationId,
        repositoryId: payload.repositoryId,
        snapshotId: payload.snapshotId,
      });

      await job.updateProgress(100);
      dependencies.logger.info(
        {
          analysisRunId: analysisRun.id,
          symbolCount: result.symbols.length,
        },
        "static analysis completed",
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
