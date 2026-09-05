import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert, Zap, Terminal } from "lucide-react";
import { PipelineViewer, PIPELINE_NODES } from "./three/PipelineViewer.js";
import type { PipelineNode } from "./three/PipelineViewer.js";

type PipelinePanelProps = {
  repositoryName?: string | undefined;
};

const LEGEND = [
  { color: "#67e8f9", label: "User Request" },
  { color: "#818cf8", label: "API Server" },
  { color: "#f97316", label: "Queue (Redis)" },
  { color: "#fb7185", label: "Worker" },
  { color: "#facc15", label: "Static Analysis" },
  { color: "#a78bfa", label: "AI Service" },
  { color: "#34d399", label: "Output" },
];

const HOW_IT_WORKS_STEPS = [
  {
    icon: "①",
    title: "Repository Ingestion",
    description:
      "GitHub URL, ZIP, or folder is cloned/extracted and staged in an isolated workspace. Files are counted, languages detected, and a snapshot is created.",
  },
  {
    icon: "②",
    title: "Static Analysis",
    description:
      "Tree-sitter parses each source file — extracting symbols (functions, classes, routes), dependency edges (imports, packages), and code chunks.",
  },
  {
    icon: "③",
    title: "Security Scan",
    description:
      "Pattern matchers scan for secrets (AWS keys, private keys, hardcoded credentials), and live-site crawls check HTTP security headers.",
  },
  {
    icon: "④",
    title: "Enrichment & Embedding",
    description:
      "Code chunks are embedded as vectors in PostgreSQL (pgvector) for semantic search. An AI summary is generated from the parsed context.",
  },
  {
    icon: "⑤",
    title: "Threat Intelligence Briefing",
    description:
      "On demand: the AI generates an adversarial briefing — attack surface map, competitive exposure, threat scenarios, and a hardening roadmap.",
  },
  {
    icon: "⑥",
    title: "Output",
    description:
      "Findings, summary, dependency graph, and threat briefing are stored and displayed. Chat uses retrieved context to answer questions.",
  },
];

const THREAT_STEPS = [
  {
    label: "Request Intercept",
    description: "Attacker clones the repo or crawls the site to map the attack surface.",
    color: "#fb7185",
  },
  {
    label: "Surface Analysis",
    description: "Dependency edges reveal third-party services, APIs, and data flows.",
    color: "#f97316",
  },
  {
    label: "Exploitation Path",
    description: "Missing auth checks, hardcoded credentials, or unpatched deps create a path in.",
    color: "#facc15",
  },
  {
    label: "Impact",
    description: "Data exfiltration, service impersonation, or competitive intelligence theft.",
    color: "#ef4444",
  },
];

export function PipelinePanel({
  repositoryName,
}: PipelinePanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="overflow-hidden rounded-md border border-slate-800 bg-panel">
      {/* Header */}
      <button
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
        onClick={() => setExpanded((prev) => !prev)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Zap aria-hidden="true" className="text-cyan-300" size={17} />
          <span className="text-sm font-medium text-white">How It Works</span>
          {repositoryName && (
            <span className="text-xs text-slate-500">— {repositoryName}</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp aria-hidden="true" className="text-slate-400" size={16} />
        ) : (
          <ChevronDown aria-hidden="true" className="text-slate-400" size={16} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-800">
          {/* 3D Pipeline Visualization */}
          <div className="relative border-b border-slate-800">
            <PipelineViewer height={260} />
            {/* Node labels overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-around px-4">
              {PIPELINE_NODES.map((node: PipelineNode) => (
                <div key={node.id} className="flex flex-col items-center">
                  <span
                    className="mb-0.5 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                    style={{
                      borderColor: node.color,
                      color: node.color,
                      backgroundColor: `${node.color}15`,
                    }}
                  >
                    {node.label}
                  </span>
                  <span className="text-[8px] text-slate-600">{node.sublabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 border-b border-slate-800 px-4 py-2">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }}
                />
                <span className="text-[10px] text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Step-by-step */}
          <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800/30 md:grid-cols-3 lg:grid-cols-6">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.icon} className="bg-panel px-3 py-3">
                <div className="mb-1 font-mono text-sm font-bold text-slate-300">{step.icon}</div>
                <div className="mb-1 text-xs font-semibold text-white">{step.title}</div>
                <div className="text-[10px] leading-relaxed text-slate-500">{step.description}</div>
              </div>
            ))}
          </div>

          {/* Threat flow */}
          <div className="border-b border-slate-800 px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="text-rose-400" size={14} />
              <span className="text-xs font-semibold uppercase tracking-widest text-rose-400">
                Threat Scenarios — what an attacker learns
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {THREAT_STEPS.map((step, index) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className="flex shrink-0 items-center gap-1">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                      style={{
                        backgroundColor: `${step.color}20`,
                        color: step.color,
                        border: `1px solid ${step.color}60`,
                      }}
                    >
                      {index + 1}
                    </div>
                    {index < THREAT_STEPS.length - 1 && (
                      <div
                        className="h-4 w-px"
                        style={{
                          backgroundColor: `${step.color}40`,
                          marginLeft: "9px",
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div
                      className="mb-0.5 text-xs font-semibold"
                      style={{ color: step.color }}
                    >
                      {step.label}
                    </div>
                    <div className="text-[10px] leading-relaxed text-slate-500">
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 bg-rose-950/30 px-4 py-3">
            <Terminal aria-hidden="true" className="mt-0.5 shrink-0 text-rose-400/70" size={12} />
            <p className="text-[10px] leading-relaxed text-slate-500">
              <span className="font-semibold text-rose-400/80">Demo visualization.</span>{" "}
              The 3D pipeline above and threat scenario steps illustrate how{" "}
              <span className="text-slate-400">{repositoryName ?? "this codebase"}</span> is
              processed. Exploitation paths shown are derived from observed static patterns — they
              represent what <em>could</em> be possible on similar real-world deployments, not
              confirmed vulnerabilities on any live system.{" "}
              <span className="text-amber-400/70">
                Always verify findings against your actual deployment.
              </span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
