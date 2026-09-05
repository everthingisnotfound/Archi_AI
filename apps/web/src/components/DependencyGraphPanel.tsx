import { AlertCircle, ArrowRight, GitBranch } from "lucide-react";

type GraphNode = {
  id: string;
  label?: string;
};

type GraphEdge = {
  source: string;
  target: string;
  type?: string;
};

type GraphJson = {
  edges?: GraphEdge[];
  nodes?: GraphNode[];
};

type GraphMetric = {
  key: string;
  score: number | string;
};

type DependencyGraphPanelProps = {
  edgeCount: number;
  graphJson?: GraphJson | null;
  metrics: GraphMetric[];
  symbolCount: number;
};

const METRIC_LABELS: Record<string, string> = {
  analyzed_file_count: "Files analyzed",
  import_edge_count: "Import/include links",
  package_dependency_count: "Package dependencies",
  symbol_count: "Code symbols",
};

function formatMetricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replaceAll("_", " ");
}

export function DependencyGraphPanel({
  edgeCount,
  graphJson,
  metrics,
  symbolCount,
}: DependencyGraphPanelProps): React.JSX.Element {
  const nodes = Array.isArray(graphJson?.nodes) ? graphJson.nodes : [];
  const edges = Array.isArray(graphJson?.edges) ? graphJson.edges : [];
  const hasGraphData = nodes.length > 0 || edges.length > 0;

  return (
    <div className="rounded-md border border-slate-800 bg-panel p-4 lg:col-span-2">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <GitBranch aria-hidden="true" className="text-cyan-300" size={17} />
        Dependency graph
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Maps file-to-file imports/includes and manifest-declared package dependencies detected during
        static analysis.
      </p>

      {hasGraphData ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-xs text-slate-500">Files (nodes)</p>
              <p className="text-lg font-semibold text-white">{nodes.length}</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-xs text-slate-500">Dependency links (edges)</p>
              <p className="text-lg font-semibold text-white">{edges.length}</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-xs text-slate-500">Code symbols</p>
              <p className="text-lg font-semibold text-white">{symbolCount}</p>
            </div>
          </div>

          {metrics.length > 0 ? (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div
                  className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  key={metric.key}
                >
                  <dt className="text-slate-500">{formatMetricLabel(metric.key)}</dt>
                  <dd className="font-medium text-white">{metric.score}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {edges.length === 0 ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-3 text-sm text-amber-100">
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="font-medium text-amber-50">No dependency links detected yet</p>
                <p className="mt-1 leading-6 text-amber-100/90">
                  {nodes.length} files were indexed as nodes, but static analysis did not find
                  import/include statements or manifest dependencies to connect them. This can happen
                  with dynamic loading, unsupported languages, or repos that rely on framework
                  autoloading without explicit includes.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sample dependency links
              </p>
              <ul className="mt-2 max-h-56 space-y-2 overflow-auto">
                {edges.slice(0, 40).map((edge, index) => (
                  <li
                    className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300"
                    key={`${edge.source}-${edge.target}-${index}`}
                  >
                    <span className="truncate">{edge.source}</span>
                    <ArrowRight aria-hidden="true" className="shrink-0 text-slate-500" size={14} />
                    <span className="truncate text-cyan-200">{edge.target}</span>
                    {edge.type ? (
                      <span className="ml-auto shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                        {edge.type}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {edges.length > 40 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Showing 40 of {edges.length} links ({edgeCount} persisted in database).
                </p>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Import and package dependency graph appears after static analysis completes.
        </p>
      )}
    </div>
  );
}
