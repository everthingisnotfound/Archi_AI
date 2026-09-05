import type { FindingCategory, FindingSeverity, PrismaClient } from "@prisma/client";
import type { EnrichmentResult } from "../ai/enrichmentClient.js";

function stripNullBytes(value: string): string {
  return value.replaceAll("\0", "");
}

function sanitizeJson(value: unknown): unknown {
  if (typeof value === "string") {
    return stripNullBytes(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeJson(entry)]),
    );
  }
  return value;
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

function mapSeverity(value: string): FindingSeverity {
  const normalized = value.toUpperCase();
  if (normalized === "CRITICAL") return "CRITICAL";
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "MEDIUM") return "MEDIUM";
  if (normalized === "LOW") return "LOW";
  return "INFO";
}

function mapCategory(value: string): FindingCategory {
  const normalized = value.toUpperCase();
  if (normalized === "SECURITY") return "SECURITY";
  if (normalized === "QUALITY") return "QUALITY";
  if (normalized === "PERFORMANCE") return "PERFORMANCE";
  if (normalized === "MAINTAINABILITY") return "MAINTAINABILITY";
  if (normalized === "DEPENDENCY") return "DEPENDENCY";
  if (normalized === "DUPLICATION") return "DUPLICATION";
  if (normalized === "DEAD_CODE") return "DEAD_CODE";
  return "SECURITY";
}

export async function persistEnrichment(
  prisma: PrismaClient,
  input: {
    analysisRunId: string;
    fileNodesByPath: Map<string, string>;
    organizationId: string;
    repositoryId: string;
    result: EnrichmentResult;
    snapshotId: string;
  },
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.finding.deleteMany({ where: { snapshotId: input.snapshotId } });
    await transaction.document.deleteMany({
      where: { snapshotId: input.snapshotId, type: "README" },
    });
    await transaction.metric.deleteMany({
      where: { key: "embedded_chunk_count", snapshotId: input.snapshotId },
    });

    for (const embedding of input.result.embeddings) {
      await transaction.$executeRawUnsafe(
        'UPDATE "CodeChunk" SET embedding = $1::vector WHERE id = $2::uuid',
        vectorLiteral(embedding.vector),
        embedding.chunk_id,
      );
    }

    await transaction.document.create({
      data: {
        contentMarkdown: stripNullBytes(input.result.summary_markdown),
        organizationId: input.organizationId,
        provenance: {
          aiEnabled: input.result.ai_enabled,
          embeddedCount: input.result.embedded_count,
        },
        repositoryId: input.repositoryId,
        snapshotId: input.snapshotId,
        title: "Repository summary",
        type: "README",
      },
    });

    for (const finding of input.result.findings) {
      const fileNodeId = input.fileNodesByPath.get(finding.path);
      await transaction.finding.create({
        data: {
          category: mapCategory(finding.category),
          description: stripNullBytes(finding.description),
          endLine: finding.end_line,
          metadata: sanitizeJson({
            path: stripNullBytes(finding.path),
            remediation: finding.remediation,
            riskExplanation: finding.risk_explanation,
          }) as object,
          organizationId: input.organizationId,
          repositoryId: input.repositoryId,
          severity: mapSeverity(finding.severity),
          snapshotId: input.snapshotId,
          startLine: finding.start_line,
          title: stripNullBytes(finding.title),
          ...(fileNodeId ? { fileNodeId } : {}),
        },
      });
    }

    await transaction.metric.create({
      data: {
        key: "embedded_chunk_count",
        metadata: {
          aiEnabled: input.result.ai_enabled,
        },
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
        score: input.result.embedded_count,
        snapshotId: input.snapshotId,
      },
    });

    await transaction.analysisRun.update({
      data: {
        completedAt: new Date(),
        stage: "COMPLETED",
        status: "SUCCEEDED",
      },
      where: {
        id: input.analysisRunId,
      },
    });
  });
}
