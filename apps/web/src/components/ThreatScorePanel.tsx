import { ShieldAlert } from "lucide-react";
import { cn } from "@ai-archaeologist/ui";

type FindingLike = {
  severity: string;
};

type ThreatScorePanelProps = {
  findings: FindingLike[];
  ready: boolean;
};

function scoreFromFindings(findings: FindingLike[]): {
  band: "CLEAR" | "WATCH" | "ELEVATED" | "CRITICAL";
  label: string;
  score: number;
} {
  const weights: Record<string, number> = {
    CRITICAL: 40,
    HIGH: 22,
    MEDIUM: 10,
    LOW: 4,
    INFO: 1,
  };
  const raw = findings.reduce((sum, finding) => sum + (weights[finding.severity.toUpperCase()] ?? 3), 0);
  const score = Math.min(99, raw);
  if (score >= 70) {
    return { band: "CRITICAL", label: "Hostile surface", score };
  }
  if (score >= 35) {
    return { band: "ELEVATED", label: "Active exposure", score };
  }
  if (score >= 10) {
    return { band: "WATCH", label: "Watch list", score };
  }
  return { band: "CLEAR", label: "No critical signals", score };
}

export function ThreatScorePanel({ findings, ready }: ThreatScorePanelProps): React.JSX.Element {
  const result = scoreFromFindings(findings);
  const criticalCount = findings.filter((finding) => finding.severity.toUpperCase() === "CRITICAL").length;
  const highCount = findings.filter((finding) => finding.severity.toUpperCase() === "HIGH").length;

  return (
    <div className="rounded-md border border-rose-500/25 bg-panel/80 p-4 shadow-danger">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden="true" className="text-rose-400" size={16} />
        <h2 className="text-sm font-medium tracking-wide text-white">Threat index</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Composite from severity-weighted findings on this snapshot. Not a pentest score.
      </p>
      {ready ? (
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p
              className={cn(
                "font-display text-4xl font-semibold tracking-widest",
                result.band === "CRITICAL" && "text-rose-400",
                result.band === "ELEVATED" && "text-amber-300",
                result.band === "WATCH" && "text-cyan-300",
                result.band === "CLEAR" && "text-emerald-300",
              )}
            >
              {String(result.score).padStart(2, "0")}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{result.label}</p>
          </div>
          <dl className="space-y-1 text-right text-xs text-slate-400">
            <div>
              <dt className="inline text-slate-500">Critical </dt>
              <dd className="inline text-rose-300">{criticalCount}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">High </dt>
              <dd className="inline text-amber-200">{highCount}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Signals </dt>
              <dd className="inline text-slate-200">{findings.length}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Threat index unlocks after analysis completes.</p>
      )}
    </div>
  );
}
