DROP INDEX IF EXISTS "CodeChunk_snapshotId_contentHash_startLine_endLine_key";

CREATE UNIQUE INDEX "CodeChunk_snapshotId_fileNodeId_contentHash_startLine_endLine_key"
ON "CodeChunk"("snapshotId", "fileNodeId", "contentHash", "startLine", "endLine");
