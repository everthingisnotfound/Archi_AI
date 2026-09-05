import { signInternalJobToken, type AnalysisJobPayload } from "@ai-archaeologist/shared";
import type { WorkerConfig } from "../config.js";

export type StaticAnalysisFile = {
  language: string | null;
  path: string;
  sizeBytes: number;
};

export type StaticAnalysisSymbol = {
  end_line: number;
  kind: string;
  name: string;
  path: string;
  start_line: number;
};

export type StaticAnalysisEdge = {
  edge_type: string;
  source_ref: string;
  target_ref: string;
};

export type StaticAnalysisChunk = {
  content_hash: string;
  end_line: number;
  path: string;
  start_line: number;
  symbol_name?: string | null;
  text: string;
};

export type StaticAnalysisResult = {
  chunks: StaticAnalysisChunk[];
  edges: StaticAnalysisEdge[];
  graph_json: {
    edges?: Array<{ source: string; target: string; type?: string }>;
    nodes?: Array<{ id: string; label?: string }>;
  };
  metrics: Record<string, number>;
  symbols: StaticAnalysisSymbol[];
};

export async function runStaticAnalysis(
  config: WorkerConfig,
  payload: AnalysisJobPayload,
  files: StaticAnalysisFile[],
): Promise<StaticAnalysisResult> {
  const token = signInternalJobToken(payload.analysisRunId, config.INTERNAL_JOB_TOKEN_SECRET);
  const response = await fetch(`${config.AI_SERVICE_URL}/internal/analysis/static`, {
    body: JSON.stringify({
      files: files.map((file) => ({
        language: file.language,
        path: file.path,
        sizeBytes: file.sizeBytes,
      })),
      organizationId: payload.organizationId,
      repositoryId: payload.repositoryId,
      snapshotId: payload.snapshotId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Static analysis failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return (await response.json()) as StaticAnalysisResult;
}
