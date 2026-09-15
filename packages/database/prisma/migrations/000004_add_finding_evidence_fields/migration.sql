ALTER TABLE "Finding"
  ADD COLUMN "findingType" VARCHAR(80) NOT NULL DEFAULT 'static',
  ADD COLUMN "confidence" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "limitations" TEXT,
  ADD COLUMN "evidence" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "Finding_findingType_confidence_idx"
  ON "Finding"("findingType", "confidence");

CREATE INDEX "Finding_snapshotId_createdAt_idx"
  ON "Finding"("snapshotId", "createdAt");

CREATE INDEX "Finding_repositoryId_findingType_idx"
  ON "Finding"("repositoryId", "findingType");
