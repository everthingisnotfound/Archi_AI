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

const BAND_CONFIG = {
  CRITICAL: {
    color: "rose",
    glowColor: "rgba(244, 63, 94, 0.5)",
    textClass: "text-rose-400",
    barClass: "bg-gradient-to-r from-rose-500 to-rose-400",
    iconClass: "text-rose-400",
  },
  ELEVATED: {
    color: "amber",
    glowColor: "rgba(251, 191, 36, 0.5)",
    textClass: "text-amber-300",
    barClass: "bg-gradient-to-r from-amber-500 to-amber-400",
    iconClass: "text-amber-400",
  },
  WATCH: {
    color: "cyan",
    glowColor: "rgba(34, 211, 238, 0.5)",
    textClass: "text-cyan-300",
    barClass: "bg-gradient-to-r from-cyan-500 to-cyan-400",
    iconClass: "text-cyan-400",
  },
  CLEAR: {
    color: "emerald",
    glowColor: "rgba(52, 211, 153, 0.5)",
    textClass: "text-emerald-300",
    barClass: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    iconClass: "text-emerald-400",
  },
} as const;

export function ThreatScorePanel({ findings, ready }: ThreatScorePanelProps): React.JSX.Element {
  const result = scoreFromFindings(findings);
  const criticalCount = findings.filter((finding) => finding.severity.toUpperCase() === "CRITICAL").length;
  const highCount = findings.filter((finding) => finding.severity.toUpperCase() === "HIGH").length;

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

  const config = BAND_CONFIG[result.band];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-xl border p-5"
      style={{
        backgroundColor: "rgba(15, 15, 25, 0.9)",
        borderColor: `${config.glowColor}`,
        boxShadow: `0 0 30px ${config.glowColor.replace('0.5', '0.15')}, inset 0 0 30px ${config.glowColor.replace('0.5', '0.05')}`,
      }}
    >
      {/* Animated corner decorations */}
      <div className={`absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 rounded-tl-xl border-${config.color}-400/50`} />
      <div className={`absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 rounded-tr-xl border-${config.color}-400/50`} />
      <div className={`absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 rounded-bl-xl border-${config.color}-400/50`} />
      <div className={`absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 rounded-br-xl border-${config.color}-400/50`} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${config.barClass} bg-opacity-20`}
          style={{ boxShadow: `0 0 20px ${config.glowColor}` }}
        >
          <ShieldAlert aria-hidden="true" className={config.iconClass} size={20} />
          {/* Pulse ring */}
          <div
            className={`absolute inset-0 animate-ping rounded-xl bg-${config.color}-400/20`}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Threat Index</h2>
          <p className="text-xs text-slate-500">
            Composite from severity-weighted findings
          </p>
        </div>
      </div>

      {ready ? (
        <div className="mt-6">
          {/* Main score display */}
          <div className="flex items-end justify-between">
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "backOut" }}
                className="relative"
              >
                <p
                  className={cn(
                    "font-mono text-6xl font-bold tracking-wider",
                    config.textClass,
                  )}
                  style={{
                    textShadow: `0 0 30px ${config.glowColor}, 0 0 60px ${config.glowColor.replace('0.5', '0.3')}`,
                  }}
                >
                  {String(displayScore).padStart(2, "0")}
                </p>

                {/* Glowing underline */}
                <div
                  className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800"
                >
                  <motion.div
                    className={config.barClass}
                    initial={{ width: "0%" }}
                    animate={{ width: `${result.score}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                    style={{
                      boxShadow: `0 0 10px ${config.glowColor}`,
                    }}
                  />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "mt-3 font-mono text-xs uppercase tracking-[0.3em]",
                  config.textClass,
                )}
              >
                {result.label}
              </motion.p>
            </div>

            {/* Stats grid */}
            <motion.div
              className="grid grid-cols-3 gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-rose-400">{criticalCount}</p>
                <p className="mt-1 text-[9px] uppercase tracking-widest text-slate-500">Critical</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-amber-400">{highCount}</p>
                <p className="mt-1 text-[9px] uppercase tracking-widest text-slate-500">High</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-slate-300">{findings.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-widest text-slate-500">Total</p>
              </div>
            </motion.div>
          </div>

          {/* Mini threat bar chart */}
          <div className="mt-6 flex items-end gap-2">
            {["Critical", "High", "Medium", "Low", "Info"].map((level, i) => {
              const count = findings.filter(f => f.severity.toUpperCase() === level.toUpperCase()).length;
              const maxCount = Math.max(...["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(l =>
                findings.filter(f => f.severity.toUpperCase() === l).length
              ), 1);
              const height = (count / maxCount) * 40;

              const colors = ["rose", "amber", "orange", "cyan", "violet"];
              const color = colors[i];

              return (
                <div key={level} className="flex flex-1 flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: Math.max(height, 4) }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                    className={cn(
                      "w-full max-w-6 rounded-t-sm bg-gradient-to-t",
                      color === "rose" && "from-rose-600 to-rose-400",
                      color === "amber" && "from-amber-600 to-amber-400",
                      color === "orange" && "from-orange-600 to-orange-400",
                      color === "cyan" && "from-cyan-600 to-cyan-400",
                      color === "violet" && "from-violet-600 to-violet-400",
                    )}
                    style={{
                      boxShadow: `0 0 10px rgba(${color === 'rose' ? '244, 63, 94' : color === 'amber' ? '251, 191, 36' : color === 'cyan' ? '34, 211, 238' : color === 'violet' ? '167, 139, 250' : '251, 146, 60'}, 0.5)`,
                    }}
                  />
                  <span className="text-[8px] text-slate-600">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-800" />
              <div className="absolute inset-0 animate-ping rounded-xl bg-rose-400/20" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-800" />
            </div>
          </div>
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/50" />
        </motion.div>
      )}
    </motion.div>
  );
}
