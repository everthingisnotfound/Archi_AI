export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

export type MembershipRole = "OWNER" | "ADMIN" | "ANALYST" | "DEVELOPER" | "VIEWER";

export type RequestContext = {
  requestId: string;
  user?: AuthenticatedUser;
};

export type IngestionJobPayload = {
  ingestionJobId: string;
  organizationId: string;
  repositoryId: string;
};

export const ingestionQueueName = "repository-ingestion";

export const analysisQueueName = "repository-analysis";

export const enrichmentQueueName = "repository-enrichment";

export const deepAnalysisQueueName = "repository-deep-analysis";

export type AnalysisJobPayload = {
  analysisRunId: string;
  organizationId: string;
  repositoryId: string;
  snapshotId: string;
};

export type EnrichmentJobPayload = AnalysisJobPayload;

export type DeepAnalysisJobPayload = AnalysisJobPayload;

export type HealthStatus = {
  status: "ok";
  service: string;
  timestamp: string;
};
