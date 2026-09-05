import type { PrismaClient } from "@prisma/client";
import type { StaticAnalysisResult } from "../ai/aiServiceClient.js";

export type PersistStaticAnalysisInput = {
  analysisRunId: string;
  fileNodesByPath: Map<string, string>;
  organizationId: string;
  repositoryId: string;
  result: StaticAnalysisResult;
  snapshotId: string;
};

async function clearSnapshotAnalysisArtifacts(
  transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  snapshotId: string,
): Promise<void> {
  await transaction.codeChunk.deleteMany({ where: { snapshotId } });
  await transaction.symbol.deleteMany({ where: { snapshotId } });
  await transaction.dependencyEdge.deleteMany({ where: { snapshotId } });
  await transaction.diagram.deleteMany({ where: { snapshotId } });
  await transaction.metric.deleteMany({ where: { snapshotId } });
}

export async function persistStaticAnalysis(
  prisma: PrismaClient,
  input: PersistStaticAnalysisInput,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await clearSnapshotAnalysisArtifacts(transaction, input.snapshotId);

    const symbolIdByKey = new Map<string, string>();

    for (const symbol of input.result.symbols) {
      const fileNodeId = input.fileNodesByPath.get(symbol.path);
      if (!fileNodeId) {
        continue;
      }

      const createdSymbol = await transaction.symbol.create({
        data: {
          endLine: symbol.end_line,
          fileNodeId,
          kind: symbol.kind,
          name: symbol.name,
          organizationId: input.organizationId,
          repositoryId: input.repositoryId,
          snapshotId: input.snapshotId,
          startLine: symbol.start_line,
        },
      });
      symbolIdByKey.set(`${symbol.path}:${symbol.name}:${symbol.start_line}`, createdSymbol.id);
    }

    if (input.result.edges.length > 0) {
      await transaction.dependencyEdge.createMany({
        data: input.result.edges.map((edge) => ({
          edgeType: edge.edge_type,
          metadata: {},
          organizationId: input.organizationId,
          repositoryId: input.repositoryId,
          snapshotId: input.snapshotId,
          sourceRef: edge.source_ref,
          targetRef: edge.target_ref,
        })),
      });
    }

    const chunkRows: Array<{
      contentHash: string;
      endLine: number;
      fileNodeId: string;
      organizationId: string;
      repositoryId: string;
      snapshotId: string;
      startLine: number;
      symbolId?: string;
      text: string;
    }> = [];
    const seenChunkKeys = new Set<string>();

    for (const chunk of input.result.chunks) {
      const fileNodeId = input.fileNodesByPath.get(chunk.path);
      if (!fileNodeId) {
        continue;
      }

      const chunkKey = `${fileNodeId}:${chunk.content_hash}:${chunk.start_line}:${chunk.end_line}`;
      if (seenChunkKeys.has(chunkKey)) {
        continue;
      }
      seenChunkKeys.add(chunkKey);

      const symbolId = chunk.symbol_name
        ? symbolIdByKey.get(`${chunk.path}:${chunk.symbol_name}:${chunk.start_line}`)
        : undefined;

      chunkRows.push({
        contentHash: chunk.content_hash,
        endLine: chunk.end_line,
        fileNodeId,
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
        snapshotId: input.snapshotId,
        startLine: chunk.start_line,
        text: chunk.text.replaceAll("\0", ""),
        ...(symbolId ? { symbolId } : {}),
      });
    }

    if (chunkRows.length > 0) {
      await transaction.codeChunk.createMany({
        data: chunkRows,
        skipDuplicates: true,
      });
    }

    await transaction.diagram.create({
      data: {
        graphJson: JSON.parse(JSON.stringify(input.result.graph_json).replaceAll("\0", "")) as object,
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
        snapshotId: input.snapshotId,
        title: "File import graph",
        type: "DEPENDENCY_GRAPH",
      },
    });

    for (const [key, score] of Object.entries(input.result.metrics)) {
      await transaction.metric.create({
        data: {
          key,
          metadata: {},
          organizationId: input.organizationId,
          repositoryId: input.repositoryId,
          score,
          snapshotId: input.snapshotId,
        },
      });
    }

    await transaction.analysisRun.update({
      data: {
        completedAt: new Date(),
        stage: "EMBEDDING",
        status: "QUEUED",
      },
      where: {
        id: input.analysisRunId,
      },
    });
  });
}
