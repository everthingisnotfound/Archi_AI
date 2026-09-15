ALTER TABLE "Finding"
  ADD COLUMN IF NOT EXISTS "findingType" VARCHAR(80) NOT NULL DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS "confidence" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "limitations" TEXT,
  ADD COLUMN IF NOT EXISTS "evidence" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "Finding_findingType_confidence_idx"
  ON "Finding"("findingType", "confidence");

CREATE INDEX IF NOT EXISTS "Finding_snapshotId_createdAt_idx"
  ON "Finding"("snapshotId", "createdAt");

CREATE INDEX IF NOT EXISTS "Finding_repositoryId_findingType_idx"
  ON "Finding"("repositoryId", "findingType");
