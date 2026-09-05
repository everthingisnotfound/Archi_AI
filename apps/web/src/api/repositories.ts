import { apiRequest } from "./client.js";
import { z } from "zod";
import {
  chatMessageResponseSchema,
  chatSessionResponseSchema,
  documentListSchema,
  findingListSchema,
  graphSummarySchema,
  ingestionJobResponseSchema,
  repositoryCreateResponseSchema,
  repositoryDetailSchema,
  repositoryListSchema,
  snapshotFilesSchema,
} from "./schemas.js";

export function listRepositories(organizationId: string) {
  return apiRequest(`/organizations/${organizationId}/repositories`, {
    method: "GET",
    schema: repositoryListSchema,
  });
}

export function getRepository(repositoryId: string) {
  return apiRequest(`/repositories/${repositoryId}`, {
    method: "GET",
    schema: repositoryDetailSchema,
  });
}

export function getIngestionJob(repositoryId: string, jobId: string) {
  return apiRequest(`/repositories/${repositoryId}/jobs/${jobId}`, {
    method: "GET",
    schema: ingestionJobResponseSchema,
  });
}

export function listSnapshotFiles(repositoryId: string, snapshotId: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=100` : "?limit=100";
  return apiRequest(`/repositories/${repositoryId}/snapshots/${snapshotId}/files${query}`, {
    method: "GET",
    schema: snapshotFilesSchema,
  });
}

export function getSnapshotGraph(repositoryId: string, snapshotId: string) {
  return apiRequest(`/repositories/${repositoryId}/snapshots/${snapshotId}/graph`, {
    method: "GET",
    schema: graphSummarySchema,
  });
}

export function listSnapshotDocuments(repositoryId: string, snapshotId: string) {
  return apiRequest(`/repositories/${repositoryId}/snapshots/${snapshotId}/documents`, {
    method: "GET",
    schema: documentListSchema,
  });
}

export function listSnapshotFindings(repositoryId: string, snapshotId: string) {
  return apiRequest(`/repositories/${repositoryId}/snapshots/${snapshotId}/findings?limit=20`, {
    method: "GET",
    schema: findingListSchema,
  });
}

export function createChatSession(repositoryId: string, input?: { title?: string }) {
  return apiRequest(`/repositories/${repositoryId}/chat/sessions`, {
    body: JSON.stringify(input ?? {}),
    method: "POST",
    schema: chatSessionResponseSchema,
  });
}

export function sendChatMessage(repositoryId: string, sessionId: string, content: string) {
  return apiRequest(`/repositories/${repositoryId}/chat/sessions/${sessionId}/messages`, {
    body: JSON.stringify({ content }),
    method: "POST",
    schema: chatMessageResponseSchema,
  });
}

export function createWebsiteRepository(input: { organizationId: string; url: string }) {
  return apiRequest(`/organizations/${input.organizationId}/repositories/website`, {
    body: JSON.stringify({ url: input.url }),
    method: "POST",
    schema: repositoryCreateResponseSchema,
  });
}

export function requestDeepAnalysis(repositoryId: string) {
  return apiRequest(`/repositories/${repositoryId}/deep-analysis`, {
    body: JSON.stringify({}),
    method: "POST",
    schema: z.object({
      queued: z.boolean(),
      snapshotId: z.string().uuid(),
    }),
  });
}

export function retryAnalysis(repositoryId: string) {
  return apiRequest(`/repositories/${repositoryId}/analysis/retry`, {
    body: JSON.stringify({}),
    method: "POST",
    schema: z.object({
      analysisRunId: z.string().uuid(),
      queued: z.boolean(),
    }),
  });
}

export function createGithubRepository(input: { organizationId: string; url: string }) {
  return apiRequest(`/organizations/${input.organizationId}/repositories/github`, {
    body: JSON.stringify({ url: input.url }),
    method: "POST",
    schema: repositoryCreateResponseSchema,
  });
}

export function createFolderRepository(input: {
  displayName: string;
  files: File[];
  organizationId: string;
}) {
  const form = new FormData();
  form.set("displayName", input.displayName);
  for (const file of input.files) {
    const folderFile = file as File & { webkitRelativePath?: string };
    form.append("files", file);
    form.append("paths", folderFile.webkitRelativePath || file.name);
  }

  return apiRequest(`/organizations/${input.organizationId}/repositories/folder`, {
    body: form,
    method: "POST",
    schema: repositoryCreateResponseSchema,
  });
}

export function createZipRepository(input: { archive: File; organizationId: string }) {
  const form = new FormData();
  form.set("archive", input.archive);
  return apiRequest(`/organizations/${input.organizationId}/repositories/zip`, {
    body: form,
    method: "POST",
    schema: repositoryCreateResponseSchema,
  });
}
