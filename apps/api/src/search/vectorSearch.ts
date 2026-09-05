import type { PrismaClient } from "@prisma/client";

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export type RetrievedChunk = {
  endLine: number;
  id: string;
  path: string;
  similarity: number;
  startLine: number;
  text: string;
};

export async function searchSimilarChunks(
  prisma: PrismaClient,
  snapshotId: string,
  queryVector: number[],
  limit = 8,
): Promise<RetrievedChunk[]> {
  if (queryVector.length === 0) {
    return [];
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      endLine: number;
      id: string;
      path: string;
      similarity: number;
      startLine: number;
      text: string;
    }>
  >(
    `
      SELECT
        c.id,
        f.path,
        c."startLine",
        c."endLine",
        c.text,
        1 - (c.embedding <=> $1::vector) AS similarity
      FROM "CodeChunk" c
      INNER JOIN "FileNode" f ON f.id = c."fileNodeId"
      WHERE c."snapshotId" = $2::uuid
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `,
    vectorLiteral(queryVector),
    snapshotId,
    limit,
  );

  return rows;
}
