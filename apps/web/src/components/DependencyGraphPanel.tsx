import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, GitBranch, Network } from "lucide-react";

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
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-panel p-5 lg:col-span-2"
      style={{
        boxShadow: "0 0 30px rgba(34, 211, 238, 0.1), inset 0 0 30px rgba(34, 211, 238, 0.02)",
      }}
    >
      {/* Corner decorations */}
      <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 rounded-tl-xl border-cyan-500/40" />
      <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 rounded-tr-xl border-cyan-500/40" />
      <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 rounded-bl-xl border-cyan-500/40" />
      <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 rounded-br-xl border-cyan-500/40" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10"
            style={{ boxShadow: "0 0 20px rgba(34, 211, 238, 0.3)" }}
          >
            <GitBranch aria-hidden="true" className="text-cyan-400" size={20} />
          </div>
          <div className="absolute inset-0 animate-ping rounded-xl bg-cyan-400/10" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-semibold tracking-wide text-white">Dependency Graph</h2>
          <p className="text-xs text-slate-500">
            File imports and package dependencies
          </p>
        </div>
      </div>

      {hasGraphData ? (
        <>
          {/* Stats grid */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="group relative overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70">Files (nodes)</p>
              <p
                className="mt-2 font-mono text-3xl font-bold text-white"
                style={{ textShadow: "0 0 20px rgba(34, 211, 238, 0.5)" }}
              >
                {nodes.length}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="group relative overflow-hidden rounded-lg border border-violet-500/20 bg-slate-900/80 p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400/70">Dependency links</p>
              <p
                className="mt-2 font-mono text-3xl font-bold text-white"
                style={{ textShadow: "0 0 20px rgba(167, 139, 250, 0.5)" }}
              >
                {edges.length}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="group relative overflow-hidden rounded-lg border border-emerald-500/20 bg-slate-900/80 p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400/70">Code symbols</p>
              <p
                className="mt-2 font-mono text-3xl font-bold text-white"
                style={{ textShadow: "0 0 20px rgba(52, 211, 153, 0.5)" }}
              >
                {symbolCount}
              </p>
            </motion.div>
          </div>

          {/* Metrics */}
          {metrics.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div
                  className="rounded-lg border border-slate-800/50 bg-slate-900/50 p-3"
                  key={metric.key}
                >
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    {formatMetricLabel(metric.key)}
                  </dt>
                  <dd className="mt-1 font-mono text-lg font-semibold text-cyan-300">{metric.score}</dd>
                </div>
              ))}
            </div>
          ) : null}

          {/* Edge list */}
          {edges.length === 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-400" size={18} />
              <div>
                <p className="font-mono text-sm font-medium text-amber-300">No dependency links detected</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {nodes.length} files indexed. No import/include statements or package dependencies found. This can happen with dynamic loading, unsupported languages, or framework autoloading.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Network className="text-cyan-400/60" size={14} />
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Sample dependency links
                </p>
              </div>
              <ul className="mt-3 max-h-60 space-y-2 overflow-auto">
                {edges.slice(0, 30).map((edge, index) => (
                  <motion.li
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-2"
                    key={`${edge.source}-${edge.target}-${index}`}
                  >
                    <span className="font-mono truncate text-xs text-slate-400">{edge.source}</span>
                    <ArrowRight aria-hidden="true" className="shrink-0 text-cyan-500/50" size={14} />
                    <span className="font-mono truncate text-xs text-cyan-300">{edge.target}</span>
                    {edge.type && (
                      <span className="ml-auto shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-400">
                        {edge.type}
                      </span>
                    )}
                  </motion.li>
                ))}
              </ul>
              {edges.length > 30 && (
                <p className="mt-3 font-mono text-xs text-slate-500">
                  Showing 30 of {edges.length} links ({edgeCount} total).
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center py-8">
          <div className="relative">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/5"
            >
              <GitBranch aria-hidden="true" className="text-cyan-400/40" size={32} />
            </div>
            <div className="absolute inset-0 animate-ping rounded-2xl bg-cyan-400/5" />
          </div>
          <p className="mt-4 font-mono text-sm text-slate-500">
            Dependency graph appears after analysis completes
          </p>
        </div>
      )}
    </motion.div>
  );
}
