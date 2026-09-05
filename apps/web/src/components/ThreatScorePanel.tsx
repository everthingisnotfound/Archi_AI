import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";
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

  // Count-up animation for the score
  const [displayScore, setDisplayScore] = useState(0);
  const spring = useSpring(0, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (ready) {
      spring.set(result.score);
      const unsubscribe = spring.on("change", (latest) => {
        setDisplayScore(Math.round(latest));
      });
      return () => {
        unsubscribe();
      };
    } else {
      setDisplayScore(0);
      return;
    }
  }, [ready, result.score, spring]);

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
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative"
            >
              <p
                className={cn(
                  "font-display text-4xl font-semibold tracking-widest",
                  result.band === "CRITICAL" && "text-rose-400",
                  result.band === "ELEVATED" && "text-amber-300",
                  result.band === "WATCH" && "text-cyan-300",
                  result.band === "CLEAR" && "text-emerald-300",
                )}
              >
                {String(displayScore).padStart(2, "0")}
              </p>
              {/* Animated progress bar */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    result.band === "CRITICAL" && "bg-rose-400",
                    result.band === "ELEVATED" && "bg-amber-300",
                    result.band === "WATCH" && "bg-cyan-300",
                    result.band === "CLEAR" && "bg-emerald-300",
                  )}
                  initial={{ width: "0%" }}
                  animate={{ width: `${result.score}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                />
              </div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400"
            >
              {result.label}
            </motion.p>
          </div>
          <motion.dl
            className="space-y-1 text-right text-xs text-slate-400"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
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
          </motion.dl>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-slate-600" />
            <p className="text-sm text-slate-500">Threat index unlocks after analysis completes.</p>
          </div>
          {/* Placeholder bar animation */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div
              className="h-full rounded-full bg-rose-500/30"
              animate={{ width: ["0%", "30%", "0%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
