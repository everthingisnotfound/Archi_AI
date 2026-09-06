import { motion } from "framer-motion";
import type { z } from "zod";
import type { findingSchema } from "../api/schemas.js";

type Finding = z.infer<typeof findingSchema>;

type SeverityConfig = { color: string; bgColor: string; borderColor: string; glowColor: string };

const SEVERITY_CONFIG: Record<string, SeverityConfig> = {
  CRITICAL: { color: "text-rose-300", bgColor: "bg-rose-500/10", borderColor: "border-rose-500/30", glowColor: "rgba(244, 63, 94, 0.3)" },
  HIGH: { color: "text-amber-300", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", glowColor: "rgba(251, 191, 36, 0.3)" },
  MEDIUM: { color: "text-orange-300", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30", glowColor: "rgba(251, 146, 60, 0.3)" },
  LOW: { color: "text-cyan-300", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30", glowColor: "rgba(34, 211, 238, 0.3)" },
  INFO: { color: "text-violet-300", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30", glowColor: "rgba(167, 139, 250, 0.3)" },
};

const DEFAULT_CONFIG: SeverityConfig = { color: "text-slate-300", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/30", glowColor: "rgba(148, 163, 184, 0.3)" };

const DEFAULT_GUIDANCE: Record<string, { risk: string; remediation: string }> = {
  "Private key material in source": {
    risk: "Private keys in source code can be used to impersonate services or decrypt protected data.",
    remediation:
      "Revoke the exposed key, store replacements outside version control, and add secret scanning to CI.",
  },
  "Possible hardcoded credential": {
    risk: "Hardcoded credentials can be extracted by anyone with repository access.",
    remediation: "Move secrets to environment variables or a vault and rotate the exposed value.",
  },
  "Possible AWS access key": {
    risk: "AWS access keys in code can lead to unauthorized cloud resource access.",
    remediation: "Deactivate the key in IAM, issue a new one, and load credentials from secure configuration.",
  },
  "Use of eval()": {
    risk: "eval() executes arbitrary code and can enable injection when input is not fully trusted.",
    remediation: "Replace eval() with explicit parsing or a tightly scoped alternative.",
  },
};

export function SecurityFindingCard({ finding }: { finding: Finding }): React.JSX.Element {
  const defaults = DEFAULT_GUIDANCE[finding.title];
  const riskExplanation = finding.metadata?.riskExplanation ?? defaults?.risk;
  const remediation = finding.metadata?.remediation ?? defaults?.remediation;
  const location =
    finding.filePath && finding.startLine
      ? `${finding.filePath}:${finding.startLine}`
      : finding.filePath ?? null;

  const severityConfig = SEVERITY_CONFIG[finding.severity] ?? DEFAULT_CONFIG;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="group relative overflow-hidden rounded-lg border p-4 text-sm transition-all duration-300"
      style={{
        backgroundColor: `${severityConfig.glowColor.replace('0.3', '0.05')}`,
        borderColor: severityConfig.borderColor,
        boxShadow: `0 0 15px ${severityConfig.glowColor}`,
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: severityConfig.glowColor }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity badge with glow */}
        <div
          className={`relative rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${severityConfig.color} ${severityConfig.bgColor}`}
          style={{
            textShadow: `0 0 10px ${severityConfig.glowColor}`,
          }}
        >
          <span className="relative">{finding.severity}</span>
        </div>

        {/* Title */}
        <span className={`font-semibold ${severityConfig.color}`}>{finding.title}</span>

        {/* Location */}
        {location && (
          <span className="ml-auto font-mono text-xs text-slate-500">{location}</span>
        )}
      </div>

      {/* Content */}
      <div className="mt-4 space-y-3">
        {/* Detected pattern */}
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            Detected Pattern
          </p>
          <pre className="overflow-x-auto rounded-md bg-slate-900/80 px-3 py-2 font-mono text-xs leading-relaxed text-slate-300">
            {finding.description}
          </pre>
        </div>

        {/* Risk explanation */}
        {riskExplanation && (
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
              <svg className="h-3 w-3 text-amber-400/70" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Risk Assessment
            </p>
            <p className="leading-relaxed text-slate-400">{riskExplanation}</p>
          </div>
        )}

        {/* Remediation */}
        {remediation && (
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
              <svg className="h-3 w-3 text-emerald-400/70" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Recommended Fix
            </p>
            <p className="leading-relaxed text-emerald-100/80">{remediation}</p>
          </div>
        )}
      </div>

      {/* Hover glow effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${severityConfig.glowColor.replace('0.3', '0.1')}, transparent 70%)`,
        }}
      />
    </motion.div>
  );
}
