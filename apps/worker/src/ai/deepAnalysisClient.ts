import { signInternalJobToken, type DeepAnalysisJobPayload } from "@ai-archaeologist/shared";
import type { WorkerConfig } from "../config.js";

export type DeepAnalysisResult = {
  completion_tokens: number;
  content_markdown: string;
  model: string;
  prompt_tokens: number;
};

export async function runDeepAnalysis(
  config: WorkerConfig,
  payload: DeepAnalysisJobPayload,
  input: {
    contextExcerpt: string;
    findings: Array<{ description: string; severity: string; title: string }>;
    graphEdges: Array<{ source: string; target: string; type: string }>;
    languages: string[];
    repositoryName: string;
    technologies: string[];
  },
): Promise<DeepAnalysisResult> {
  const token = signInternalJobToken(`${payload.snapshotId}-deep`, config.INTERNAL_JOB_TOKEN_SECRET);
  const response = await fetch(`${config.AI_SERVICE_URL}/internal/analysis/deep`, {
    body: JSON.stringify({
      analysisRunId: payload.analysisRunId,
      contextExcerpt: input.contextExcerpt,
      findings: input.findings,
      graphEdges: input.graphEdges,
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
    throw new Error(`Deep analysis failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return (await response.json()) as DeepAnalysisResult;
}
