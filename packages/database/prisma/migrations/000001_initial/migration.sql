CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'ANALYST', 'DEVELOPER', 'VIEWER');
CREATE TYPE "RepositorySourceType" AS ENUM ('GITHUB', 'ZIP', 'FOLDER');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "AnalysisRunStage" AS ENUM ('PARSING', 'GRAPHING', 'EMBEDDING', 'SCORING', 'DOCUMENTING', 'COMPLETED', 'FAILED');
CREATE TYPE "DiagramType" AS ENUM ('DEPENDENCY_GRAPH', 'CLASS_DIAGRAM', 'SEQUENCE_DIAGRAM', 'DATABASE_DIAGRAM', 'REST_API_DIAGRAM', 'CALL_GRAPH', 'FOLDER_STRUCTURE');
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FindingCategory" AS ENUM ('SECURITY', 'QUALITY', 'PERFORMANCE', 'MAINTAINABILITY', 'DEPENDENCY', 'DUPLICATION', 'DEAD_CODE');
CREATE TYPE "DocumentType" AS ENUM ('README', 'API', 'ARCHITECTURE', 'ONBOARDING', 'DEPLOYMENT', 'TESTING', 'MODULE');
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

CREATE TABLE "Organization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "passwordHash" VARCHAR(512) NOT NULL,
  "createdOrganizationId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "userAgent" VARCHAR(512),
  "ipAddress" VARCHAR(128),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Repository" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "defaultBranch" VARCHAR(180),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepositorySource" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "type" "RepositorySourceType" NOT NULL,
  "uri" VARCHAR(2048),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepositorySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepositorySnapshot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "commitSha" VARCHAR(80),
  "contentHash" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepositorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IngestionJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "failureCode" VARCHAR(80),
  "failureMessage" VARCHAR(500),
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "stage" "AnalysisRunStage" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "promptVersion" VARCHAR(80),
  "modelMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileNode" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "path" VARCHAR(512) NOT NULL,
  "language" VARCHAR(80),
  "sizeBytes" INTEGER NOT NULL,
  "contentHash" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Symbol" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "fileNodeId" UUID NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "kind" VARCHAR(80) NOT NULL,
  "startLine" INTEGER NOT NULL,
  "endLine" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DependencyEdge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "sourceRef" VARCHAR(512) NOT NULL,
  "targetRef" VARCHAR(512) NOT NULL,
  "edgeType" VARCHAR(80) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "DependencyEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodeChunk" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "fileNodeId" UUID NOT NULL,
  "symbolId" UUID,
  "contentHash" VARCHAR(128) NOT NULL,
  "startLine" INTEGER NOT NULL,
  "endLine" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "embedding" vector(1536),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "CodeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Diagram" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "type" "DiagramType" NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "graphJson" JSONB NOT NULL,
  "mermaidSource" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Finding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "fileNodeId" UUID,
  "severity" "FindingSeverity" NOT NULL,
  "category" "FindingCategory" NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "description" TEXT NOT NULL,
  "startLine" INTEGER,
  "endLine" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Metric" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "score" DECIMAL(8, 3) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "type" "DocumentType" NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "contentMarkdown" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "promptVersion" VARCHAR(80),
  "modelMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "title" VARCHAR(180),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "userId" UUID,
  "role" "ChatRole" NOT NULL,
  "content" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "modelMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID,
  "userId" UUID,
  "action" VARCHAR(160) NOT NULL,
  "resourceType" VARCHAR(120) NOT NULL,
  "resourceId" VARCHAR(120),
  "ipAddress" VARCHAR(128),
  "userAgent" VARCHAR(512),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX "Membership_organizationId_role_idx" ON "Membership"("organizationId", "role");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Repository_organizationId_idx" ON "Repository"("organizationId");
CREATE UNIQUE INDEX "Repository_organizationId_name_key" ON "Repository"("organizationId", "name");
CREATE INDEX "RepositorySource_organizationId_idx" ON "RepositorySource"("organizationId");
CREATE INDEX "RepositorySource_repositoryId_idx" ON "RepositorySource"("repositoryId");
CREATE INDEX "RepositorySnapshot_organizationId_idx" ON "RepositorySnapshot"("organizationId");
CREATE INDEX "RepositorySnapshot_repositoryId_idx" ON "RepositorySnapshot"("repositoryId");
CREATE UNIQUE INDEX "RepositorySnapshot_repositoryId_contentHash_key" ON "RepositorySnapshot"("repositoryId", "contentHash");
CREATE INDEX "IngestionJob_organizationId_idx" ON "IngestionJob"("organizationId");
CREATE INDEX "IngestionJob_repositoryId_idx" ON "IngestionJob"("repositoryId");
CREATE INDEX "IngestionJob_status_idx" ON "IngestionJob"("status");
CREATE INDEX "AnalysisRun_organizationId_idx" ON "AnalysisRun"("organizationId");
CREATE INDEX "AnalysisRun_repositoryId_snapshotId_idx" ON "AnalysisRun"("repositoryId", "snapshotId");
CREATE INDEX "AnalysisRun_status_idx" ON "AnalysisRun"("status");
CREATE INDEX "FileNode_organizationId_idx" ON "FileNode"("organizationId");
CREATE INDEX "FileNode_repositoryId_snapshotId_idx" ON "FileNode"("repositoryId", "snapshotId");
CREATE UNIQUE INDEX "FileNode_snapshotId_path_key" ON "FileNode"("snapshotId", "path");
CREATE INDEX "Symbol_organizationId_idx" ON "Symbol"("organizationId");
CREATE INDEX "Symbol_repositoryId_snapshotId_idx" ON "Symbol"("repositoryId", "snapshotId");
CREATE INDEX "Symbol_fileNodeId_idx" ON "Symbol"("fileNodeId");
CREATE INDEX "DependencyEdge_organizationId_idx" ON "DependencyEdge"("organizationId");
CREATE INDEX "DependencyEdge_repositoryId_snapshotId_idx" ON "DependencyEdge"("repositoryId", "snapshotId");
CREATE INDEX "DependencyEdge_edgeType_idx" ON "DependencyEdge"("edgeType");
CREATE INDEX "CodeChunk_organizationId_idx" ON "CodeChunk"("organizationId");
CREATE INDEX "CodeChunk_repositoryId_snapshotId_idx" ON "CodeChunk"("repositoryId", "snapshotId");
CREATE INDEX "CodeChunk_fileNodeId_idx" ON "CodeChunk"("fileNodeId");
CREATE UNIQUE INDEX "CodeChunk_snapshotId_contentHash_startLine_endLine_key" ON "CodeChunk"("snapshotId", "contentHash", "startLine", "endLine");
CREATE INDEX "Diagram_organizationId_idx" ON "Diagram"("organizationId");
CREATE INDEX "Diagram_repositoryId_snapshotId_type_idx" ON "Diagram"("repositoryId", "snapshotId", "type");
CREATE INDEX "Finding_organizationId_idx" ON "Finding"("organizationId");
CREATE INDEX "Finding_repositoryId_snapshotId_idx" ON "Finding"("repositoryId", "snapshotId");
CREATE INDEX "Finding_severity_category_idx" ON "Finding"("severity", "category");
CREATE INDEX "Metric_organizationId_idx" ON "Metric"("organizationId");
CREATE INDEX "Metric_repositoryId_snapshotId_idx" ON "Metric"("repositoryId", "snapshotId");
CREATE UNIQUE INDEX "Metric_snapshotId_key_key" ON "Metric"("snapshotId", "key");
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX "Document_repositoryId_snapshotId_type_idx" ON "Document"("repositoryId", "snapshotId", "type");
CREATE INDEX "ChatSession_organizationId_idx" ON "ChatSession"("organizationId");
CREATE INDEX "ChatSession_repositoryId_updatedAt_idx" ON "ChatSession"("repositoryId", "updatedAt");
CREATE INDEX "ChatMessage_organizationId_idx" ON "ChatMessage"("organizationId");
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");
CREATE INDEX "AuditEvent_organizationId_idx" ON "AuditEvent"("organizationId");
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

ALTER TABLE "User" ADD CONSTRAINT "User_createdOrganizationId_fkey" FOREIGN KEY ("createdOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepositorySource" ADD CONSTRAINT "RepositorySource_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepositorySnapshot" ADD CONSTRAINT "RepositorySnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RepositorySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Symbol" ADD CONSTRAINT "Symbol_fileNodeId_fkey" FOREIGN KEY ("fileNodeId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Symbol" ADD CONSTRAINT "Symbol_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeChunk" ADD CONSTRAINT "CodeChunk_fileNodeId_fkey" FOREIGN KEY ("fileNodeId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeChunk" ADD CONSTRAINT "CodeChunk_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeChunk" ADD CONSTRAINT "CodeChunk_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_fileNodeId_fkey" FOREIGN KEY ("fileNodeId") REFERENCES "FileNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

