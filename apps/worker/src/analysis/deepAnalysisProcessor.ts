import { deepAnalysisJobPayloadSchema } from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { runDeepAnalysis } from "../ai/deepAnalysisClient.js";
import type { WorkerConfig } from "../config.js";
import type { WorkerLogger } from "../logger.js";

export function createDeepAnalysisProcessor(dependencies: {
  config: WorkerConfig;
  logger: WorkerLogger;
  prisma: PrismaClient;
}) {
  return async (job: Job<unknown>): Promise<void> => {
    const payload = deepAnalysisJobPayloadSchema.parse(job.data);

    const [repository, snapshot, findings, diagram, chunks] = await Promise.all([
      dependencies.prisma.repository.findUnique({ where: { id: payload.repositoryId } }),
      dependencies.prisma.repositorySnapshot.findFirst({
        where: { id: payload.snapshotId, repositoryId: payload.repositoryId },
      }),
      dependencies.prisma.finding.findMany({
        take: 24,
        where: { snapshotId: payload.snapshotId },
      }),
      dependencies.prisma.diagram.findFirst({
        where: { snapshotId: payload.snapshotId, type: "DEPENDENCY_GRAPH" },
      }),
      dependencies.prisma.codeChunk.findMany({
        include: { fileNode: { select: { path: true } } },
        take: 8,
        where: { snapshotId: payload.snapshotId },
      }),
    ]);

    if (!repository || !snapshot) {
      throw new Error("Repository snapshot was not found for deep analysis.");
    }

    const graphJson = (diagram?.graphJson ?? {}) as {
      edges?: Array<{ source?: string; target?: string; type?: string }>;
    };
    const ingestion = await dependencies.prisma.ingestionJob.findFirst({
      orderBy: { createdAt: "desc" },
      where: { repositoryId: payload.repositoryId, status: "SUCCEEDED" },
    });
    const ingestionResult = ingestion?.result as
      | { languages?: string[]; technologies?: string[] }
      | undefined;

    const result = await runDeepAnalysis(dependencies.config, payload, {
      contextExcerpt: chunks
        .map((chunk) => `### ${chunk.fileNode.path}\n${chunk.text.slice(0, 900)}`)
        .join("\n\n"),
      findings: findings.map((finding) => ({
        description: finding.description,
        severity: finding.severity,
        title: finding.title,
      })),
      graphEdges: (graphJson.edges ?? []).map((edge) => ({
        source: edge.source ?? "",
        target: edge.target ?? "",
        type: edge.type ?? "edge",
      })),
      languages: ingestionResult?.languages ?? [],
      repositoryName: repository.name,
      technologies: ingestionResult?.technologies ?? [],
    });

    await dependencies.prisma.document.deleteMany({
      where: {
        snapshotId: payload.snapshotId,
        type: "DEEP_DIVE",
      },
    });
    await dependencies.prisma.document.create({
      data: {
        contentMarkdown: result.content_markdown,
        modelMetadata: {
          completionTokens: result.completion_tokens,
          model: result.model,
          promptTokens: result.prompt_tokens,
        },
        organizationId: payload.organizationId,
        provenance: { kind: "deep-analysis" },
        repositoryId: payload.repositoryId,
        snapshotId: payload.snapshotId,
        title: "Deeper analysis",
        type: "DEEP_DIVE",
      },
    });

    dependencies.logger.info(
      { snapshotId: payload.snapshotId, model: result.model },
      "deep analysis document stored",
    );
  };
}
