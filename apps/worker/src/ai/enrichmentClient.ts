import { signInternalJobToken, type EnrichmentJobPayload } from "@ai-archaeologist/shared";
import type { WorkerConfig } from "../config.js";

export type EnrichmentChunkInput = {
  id: string;
  path: string;
  text: string;
};

export type EnrichmentFileInput = {
  language: string | null;
  path: string;
  sizeBytes: number;
};

export type EnrichmentResult = {
  ai_enabled: boolean;
  embedded_count: number;
  embeddings: Array<{ chunk_id: string; vector: number[] }>;
  findings: Array<{
    category: string;
    description: string;
    end_line: number;
    path: string;
    remediation: string;
    risk_explanation: string;
    severity: string;
    start_line: number;
    title: string;
  }>;
  summary_markdown: string;
};

export async function runEnrichment(
  config: WorkerConfig,
  payload: EnrichmentJobPayload,
  input: {
    chunks: EnrichmentChunkInput[];
    files: EnrichmentFileInput[];
    languages: string[];
    repositoryName: string;
    technologies: string[];
  },
): Promise<EnrichmentResult> {
  const token = signInternalJobToken(payload.analysisRunId, config.INTERNAL_JOB_TOKEN_SECRET);
  const response = await fetch(`${config.AI_SERVICE_URL}/internal/analysis/enrich`, {
    body: JSON.stringify({
      analysisRunId: payload.analysisRunId,
      chunks: input.chunks,
      files: input.files.map((file) => ({
        language: file.language,
        path: file.path,
        sizeBytes: file.sizeBytes,
      })),
      languages: input.languages,
      organizationId: payload.organizationId,
      repositoryId: payload.repositoryId,
      repositoryName: input.repositoryName,
      snapshotId: payload.snapshotId,
      technologies: input.technologies,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enrichment failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return (await response.json()) as EnrichmentResult;
}
