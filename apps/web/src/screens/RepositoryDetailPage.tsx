import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, FileCode2, FolderTree, Loader2, RotateCcw, ScanSearch, ShieldAlert } from "lucide-react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import { Badge, Button } from "@ai-archaeologist/ui";
import type { AuthResponse } from "../api/schemas.js";
import {
  getIngestionJob,
  getRepository,
  getSnapshotGraph,
  listSnapshotDocuments,
  listSnapshotFiles,
  listSnapshotFindings,
  requestDeepAnalysis,
  retryAnalysis,
} from "../api/repositories.js";
import { RepositoryChatPanel } from "../components/RepositoryChatPanel.js";
import { DependencyGraphPanel } from "../components/DependencyGraphPanel.js";
import { PipelinePanel } from "../components/PipelinePanel.js";
import { SecurityFindingCard } from "../components/SecurityFindingCard.js";
import { ThreatScorePanel } from "../components/ThreatScorePanel.js";

type ShellContext = {
  me?: Omit<AuthResponse, "organization">;
};

const activeJobStatuses = new Set(["QUEUED", "RUNNING"]);

export function RepositoryDetailPage(): React.JSX.Element {
  const { repositoryId = "" } = useParams();
  const { me } = useOutletContext<ShellContext>();
  const queryClient = useQueryClient();
  const [deepQueuedAt, setDeepQueuedAt] = useState<number | null>(null);

  const repositoryQuery = useQuery({
    enabled: Boolean(repositoryId),
    queryFn: () => getRepository(repositoryId),
    queryKey: ["repository", repositoryId],
    refetchInterval: (query) => {
      const ingestionStatus = query.state.data?.latestIngestionJob?.status;
      const analysisStatus = query.state.data?.latestAnalysisRun?.status;
      if (ingestionStatus && activeJobStatuses.has(ingestionStatus)) {
        return 2000;
      }
      if (analysisStatus && activeJobStatuses.has(analysisStatus)) {
        return 2000;
      }
      return false;
    },
  });

  const latestJob = repositoryQuery.data?.latestIngestionJob;
  const latestAnalysisRun = repositoryQuery.data?.latestAnalysisRun;
  const latestSnapshot = repositoryQuery.data?.latestSnapshot;
  const resultSnapshotId =
    latestJob?.result && typeof latestJob.result.snapshotId === "string"
      ? latestJob.result.snapshotId
      : undefined;
  const snapshotId = latestSnapshot?.id ?? resultSnapshotId;

  const jobQuery = useQuery({
    enabled: Boolean(repositoryId && latestJob?.id),
    queryFn: () => getIngestionJob(repositoryId, latestJob?.id ?? ""),
    queryKey: ["ingestion-job", repositoryId, latestJob?.id],
    refetchInterval: latestJob && activeJobStatuses.has(latestJob.status) ? 2000 : false,
  });

  const filesQuery = useQuery({
    enabled: Boolean(repositoryId && snapshotId && latestJob?.status === "SUCCEEDED"),
    queryFn: () => listSnapshotFiles(repositoryId, snapshotId ?? ""),
    queryKey: ["snapshot-files", repositoryId, snapshotId],
  });

  const graphQuery = useQuery({
    enabled: Boolean(
      repositoryId && snapshotId && latestAnalysisRun?.status === "SUCCEEDED",
    ),
    queryFn: () => getSnapshotGraph(repositoryId, snapshotId ?? ""),
    queryKey: ["snapshot-graph", repositoryId, snapshotId],
  });

  const documentsQuery = useQuery({
    enabled: Boolean(
      repositoryId && snapshotId && latestAnalysisRun?.stage === "COMPLETED",
    ),
    queryFn: () => listSnapshotDocuments(repositoryId, snapshotId ?? ""),
    queryKey: ["snapshot-documents", repositoryId, snapshotId],
    refetchInterval: (query) => {
      if (!deepQueuedAt) {
        return false;
      }
      const hasDeep = query.state.data?.items.some((item) => item.type === "DEEP_DIVE");
      return hasDeep ? false : 2500;
    },
  });

  const deepAnalysisMutation = useMutation({
    mutationFn: () => requestDeepAnalysis(repositoryId),
    onSuccess: async () => {
      setDeepQueuedAt(Date.now());
      await queryClient.invalidateQueries({ queryKey: ["snapshot-documents", repositoryId, snapshotId] });
    },
  });

  const retryAnalysisMutation = useMutation({
    mutationFn: () => retryAnalysis(repositoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["repository", repositoryId] });
    },
  });

  const findingsQuery = useQuery({
    enabled: Boolean(
      repositoryId && snapshotId && latestAnalysisRun?.stage === "COMPLETED",
    ),
    queryFn: () => listSnapshotFindings(repositoryId, snapshotId ?? ""),
    queryKey: ["snapshot-findings", repositoryId, snapshotId],
  });

  const chatEnabled = latestAnalysisRun?.stage === "COMPLETED" && latestAnalysisRun.status === "SUCCEEDED";

  if (!me?.user) {
    return <Navigate to="/login" replace />;
  }

  const ingestionJob = jobQuery.data?.ingestionJob ?? latestJob;
  const errorMessage =
    repositoryQuery.error instanceof Error
      ? repositoryQuery.error.message
      : jobQuery.error instanceof Error
        ? jobQuery.error.message
        : filesQuery.error instanceof Error
          ? filesQuery.error.message
          : graphQuery.error instanceof Error
            ? graphQuery.error.message
            : undefined;

  const languages = Array.isArray(ingestionJob?.result?.languages)
    ? (ingestionJob?.result?.languages as string[])
    : [];
  const technologies = Array.isArray(ingestionJob?.result?.technologies)
    ? (ingestionJob?.result?.technologies as string[])
    : [];
  const sourceType = repositoryQuery.data?.sourceType;
  const isWebsite = sourceType === "WEBSITE";
  const summaryDocument = documentsQuery.data?.items.find((item) => item.type === "README");
  const deepDocument = documentsQuery.data?.items.find((item) => item.type === "DEEP_DIVE");

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            to="/"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to repositories
          </Link>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="cyan">Ingestion</Badge>
            {latestAnalysisRun ? <Badge variant="neutral">Analysis {latestAnalysisRun.status}</Badge> : null}
            {ingestionJob ? <Badge variant="neutral">Ingestion {ingestionJob.status}</Badge> : null}
            {isWebsite ? <Badge variant="cyan">Live site</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold text-white">
            {repositoryQuery.data?.repository.name ?? "Repository"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {isWebsite
              ? "Limited public crawl of the deployed site (pages, assets, headers, third-party scripts). Not a full source dump."
              : "Verified snapshot of the repository at ingestion time. Metrics below come from deterministic scans (file indexing, static analysis, and secret pattern matching)."}
          </p>
          {repositoryQuery.data?.sourceUri ? (
            <p className="mt-2 truncate text-xs text-cyan-300/80">{repositoryQuery.data.sourceUri}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {latestAnalysisRun &&
          !(latestAnalysisRun.status === "SUCCEEDED" && latestAnalysisRun.stage === "COMPLETED") ? (
            <Button
              disabled={retryAnalysisMutation.isPending}
              onClick={() => { retryAnalysisMutation.mutate(); }}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Retry analysis
            </Button>
          ) : null}
          {chatEnabled ? (
            <Button
              disabled={deepAnalysisMutation.isPending}
              onClick={() => { deepAnalysisMutation.mutate(); }}
              type="button"
              variant="neon"
            >
              <ScanSearch aria-hidden="true" size={16} />
              {deepDocument ? "Regenerate briefing" : "Threat briefing"}
            </Button>
          ) : null}
          {repositoryQuery.isFetching || jobQuery.isFetching ? (
            <Loader2 aria-hidden="true" className="animate-spin text-slate-400" size={18} />
          ) : null}
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {retryAnalysisMutation.error instanceof Error ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          <span>{retryAnalysisMutation.error.message}</span>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-800 bg-panel p-4">
          <h2 className="text-sm font-medium text-white">Static analysis</h2>
          <p className="mt-1 text-xs text-slate-500">
            Symbol extraction and dependency linking from source files and manifest files.
          </p>
          {latestAnalysisRun ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="text-white">{latestAnalysisRun.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Stage</dt>
                <dd className="text-white">{latestAnalysisRun.stage}</dd>
              </div>
              {graphQuery.data ? (
                <>
                  <div>
                    <dt className="text-slate-500">Symbols</dt>
                    <dd className="text-white">
                      {graphQuery.data.symbolCount}
                      <span className="ml-2 text-xs text-slate-500">functions, classes, types</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Graph edges</dt>
                    <dd className="text-white">
                      {graphQuery.data.edgeCount}
                      <span className="ml-2 text-xs text-slate-500">imports and package deps</span>
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Analysis starts after ingestion completes.</p>
          )}
        </div>

        <DependencyGraphPanel
          edgeCount={graphQuery.data?.edgeCount ?? 0}
          graphJson={
            (graphQuery.data?.diagram?.graphJson as
              | {
                  edges?: Array<{ source: string; target: string; type?: string }>;
                  nodes?: Array<{ id: string; label?: string }>;
                }
              | undefined) ?? null
          }
          metrics={graphQuery.data?.metrics ?? []}
          symbolCount={graphQuery.data?.symbolCount ?? 0}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ThreatScorePanel
          findings={findingsQuery.data?.items ?? []}
          ready={latestAnalysisRun?.stage === "COMPLETED"}
        />
        <div className="rounded-md border border-slate-800 bg-panel p-4">
          <h2 className="text-sm font-medium text-white">Ingestion job</h2>
          {ingestionJob ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="text-white">{ingestionJob.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Progress</dt>
                <dd className="text-white">{ingestionJob.progress ?? 0}%</dd>
              </div>
              {ingestionJob.failureMessage ? (
                <div>
                  <dt className="text-slate-500">Failure</dt>
                  <dd className="text-rose-100">{ingestionJob.failureMessage}</dd>
                </div>
              ) : null}
              {typeof ingestionJob.result?.fileCount === "number" ? (
                <div>
                  <dt className="text-slate-500">Indexed files</dt>
                  <dd className="text-white">{String(ingestionJob.result.fileCount)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No ingestion job found.</p>
          )}
        </div>

        <div className="rounded-md border border-slate-800 bg-panel p-4">
          <h2 className="text-sm font-medium text-white">Detected stack</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {languages.map((language) => (
              <Badge key={language} variant="cyan">
                {language}
              </Badge>
            ))}
            {technologies.map((technology) => (
              <Badge key={technology} variant="neutral">
                {technology}
              </Badge>
            ))}
            {languages.length === 0 && technologies.length === 0 ? (
              <p className="text-sm text-slate-500">Detection results appear after ingestion succeeds.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-800 bg-panel p-4 lg:col-span-1">
          <h2 className="text-sm font-medium text-white">Repository summary</h2>
          <p className="mt-1 text-xs text-slate-500">
            AI narrative when configured; otherwise a deterministic overview from indexed files.
          </p>
          {summaryDocument ? (
            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {summaryDocument.contentMarkdown}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Summary document appears after enrichment completes.
            </p>
          )}
        </div>

        <div className="rounded-md border border-slate-800 bg-panel p-4">
          <h2 className="text-sm font-medium text-white">Security findings</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pattern-based secret and risk detection with remediation guidance.
          </p>
          <div className="mt-4 space-y-3">
            {findingsQuery.data?.items.map((finding) => (
              <SecurityFindingCard finding={finding} key={finding.id} />
            ))}
            {findingsQuery.data?.items.length === 0 && latestAnalysisRun?.stage === "COMPLETED" ? (
              <p className="text-sm text-slate-500">
                No deterministic secret-pattern findings detected in indexed files.
              </p>
            ) : null}
            {latestAnalysisRun?.stage !== "COMPLETED" ? (
              <p className="text-sm text-slate-500">Findings appear after enrichment completes.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-slate-800 bg-panel p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-white">Threat Intelligence Briefing</h2>
            <p className="mt-1 text-xs text-slate-500">
              Adversarial analysis: attack surface, competitive exposure, threat scenarios, and a
              hardening roadmap — all grounded in the observed snapshot, nothing invented.
            </p>
          </div>
        </div>
        {deepAnalysisMutation.error instanceof Error ? (
          <p className="mt-3 text-sm text-rose-200">{deepAnalysisMutation.error.message}</p>
        ) : null}
        {deepDocument ? (
          <pre className="mt-4 max-h-[40rem] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-300">
            {deepDocument.contentMarkdown}
          </pre>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {deepAnalysisMutation.isPending || deepQueuedAt
              ? "Threat briefing is running. Grounding this in the snapshot now."
              : "Run the Threat briefing after enrichment completes. It consumes only observed files, symbols, dependencies, and findings — no invented controls or runtime secrets."}
          </p>
        )}
      </section>

      <RepositoryChatPanel enabled={Boolean(chatEnabled)} repositoryId={repositoryId} />

      <section className="overflow-hidden rounded-md border border-slate-800 bg-panel">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-sm font-medium text-white">
          <FolderTree aria-hidden="true" className="text-emerald-300" size={17} />
          Snapshot files
        </div>
        <div className="divide-y divide-slate-800">
          {filesQuery.data?.items.map((file, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-[1fr_120px_100px] items-center gap-3 px-4 py-3 text-sm"
              initial={{ opacity: 0, y: 8 }}
              key={file.id}
              transition={{ delay: index * 0.01 }}
            >
              <span className="flex min-w-0 items-center gap-2 text-white">
                <FileCode2 aria-hidden="true" className="shrink-0 text-slate-500" size={15} />
                <span className="truncate">{file.path}</span>
              </span>
              <span className="text-slate-400">{file.language ?? "unknown"}</span>
              <span className="text-slate-500">{file.sizeBytes.toLocaleString()} B</span>
            </motion.div>
          ))}
          {latestJob?.status !== "SUCCEEDED" ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Files appear here once ingestion completes.
            </div>
          ) : null}
          {latestJob?.status === "SUCCEEDED" && filesQuery.data?.items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">No files indexed.</div>
          ) : null}
        </div>
        {filesQuery.data?.nextCursor ? (
          <div className="border-t border-slate-800 px-4 py-3">
            <Button disabled size="sm" variant="subtle">
              More files available in a later UI pass
            </Button>
          </div>
        ) : null}
      </section>

      <PipelinePanel
        repositoryName={repositoryQuery.data?.repository.name}
      />
    </div>
  );
}
