import { Badge } from "@ai-archaeologist/ui";
import type { z } from "zod";
import type { findingSchema } from "../api/schemas.js";

type Finding = z.infer<typeof findingSchema>;

const SEVERITY_VARIANT: Record<string, "neutral" | "cyan"> = {
  CRITICAL: "neutral",
  HIGH: "neutral",
  MEDIUM: "cyan",
  LOW: "cyan",
  INFO: "cyan",
};

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

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_VARIANT[finding.severity] ?? "cyan"}>{finding.severity}</Badge>
        <span className="font-medium text-white">{finding.title}</span>
        {location ? <span className="text-xs text-slate-500">{location}</span> : null}
      </div>

      <div className="mt-3 space-y-2 text-slate-300">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Detected</p>
          <pre className="mt-1 overflow-x-auto rounded bg-slate-900 px-2 py-1 text-xs text-slate-300">
            {finding.description}
          </pre>
        </div>

        {riskExplanation ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Why it matters</p>
            <p className="mt-1 leading-6 text-slate-400">{riskExplanation}</p>
          </div>
        ) : null}

        {remediation ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recommended fix</p>
            <p className="mt-1 leading-6 text-emerald-100/90">{remediation}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
