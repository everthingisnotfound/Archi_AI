import { motion } from "framer-motion";
import { AlertTriangle, Shield, Target, TrendingUp, Zap } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@ai-archaeologist/ui";

type SectionType = "attack-surface" | "threat-scenarios" | "exposure" | "hardening" | "summary";
type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

type ThreatBriefingCardsProps = {
  content: string;
  className?: string;
};

interface ParsedSection {
  type: SectionType;
  title: string;
  severity?: SeverityLevel | undefined;
  content: string;
  bullets: string[];
}

const SECTION_PATTERNS: Record<SectionType, RegExp> = {
  "attack-surface": /^#{1,3}\s*(attack\s*surface|surface\s*analysis|exposed\s*surface)/im,
  "threat-scenarios": /^#{1,3}\s*(threat\s*scenario|attack\s*path|exploitation)/im,
  exposure: /^#{1,3}\s*(exposure|competitive|intelligence)/im,
  hardening: /^#{1,3}\s*(hardening|remediation|mitigation|recommendation)/im,
  summary: /^#{1,3}\s*(summary|overview|conclusion)/im,
};

const SEVERITY_CONFIG: Record<SeverityLevel, { textColor: string; bgColor: string; borderColor: string; glowColor: string }> = {
  critical: { textColor: "text-rose-400", bgColor: "bg-rose-500/10", borderColor: "border-rose-500/30", glowColor: "rgba(244, 63, 94, 0.3)" },
  high: { textColor: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", glowColor: "rgba(251, 191, 36, 0.3)" },
  medium: { textColor: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30", glowColor: "rgba(251, 146, 60, 0.3)" },
  low: { textColor: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30", glowColor: "rgba(34, 211, 238, 0.3)" },
  info: { textColor: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30", glowColor: "rgba(167, 139, 250, 0.3)" },
};

const VARIANT_CONFIG: Record<string, { textColor: string; bgColor: string; borderColor: string; glowColor: string }> = {
  cyan: { textColor: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30", glowColor: "rgba(34, 211, 238, 0.3)" },
  rose: { textColor: "text-rose-400", bgColor: "bg-rose-500/10", borderColor: "border-rose-500/30", glowColor: "rgba(244, 63, 94, 0.3)" },
  amber: { textColor: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", glowColor: "rgba(251, 191, 36, 0.3)" },
  emerald: { textColor: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30", glowColor: "rgba(52, 211, 153, 0.3)" },
  violet: { textColor: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30", glowColor: "rgba(167, 139, 250, 0.3)" },
};

const DEFAULT_CONFIG = { textColor: "text-slate-400", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/30", glowColor: "rgba(148, 163, 184, 0.3)" };

function detectSeverity(line: string): SeverityLevel | undefined {
  const lowerLine = line.toLowerCase();
  if (lowerLine.includes("critical") || lowerLine.includes("severity: critical")) return "critical";
  if (lowerLine.includes("high") || lowerLine.includes("severity: high")) return "high";
  if (lowerLine.includes("medium") || lowerLine.includes("severity: medium")) return "medium";
  if (lowerLine.includes("low") || lowerLine.includes("severity: low")) return "low";
  if (lowerLine.includes("info") || lowerLine.includes("note")) return "info";
  return undefined;
}

function createSection(type: SectionType, title: string, severity: SeverityLevel | undefined): ParsedSection {
  return {
    type,
    title,
    severity,
    content: "",
    bullets: [],
  };
}

function parseBriefingMarkdown(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = markdown.split("\n");
  let currentSection: ParsedSection | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        currentSection.content = currentContent.join("\n").trim();
        currentSection.bullets = currentContent
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .map((l) => l.replace(/^[-*]\s+/, "").trim());
        sections.push(currentSection);
      }

      const headingText = headingMatch[2]!.trim();
      const severity = detectSeverity(headingText);

      let sectionType: SectionType = "summary";
      for (const [type, pattern] of Object.entries(SECTION_PATTERNS)) {
        if (pattern.test(headingText)) {
          sectionType = type as SectionType;
          break;
        }
      }

      currentSection = createSection(
        sectionType,
        headingText.replace(/\*\*/g, "").trim(),
        severity,
      );
      currentContent = [];
    } else if (currentSection && line.trim()) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    currentSection.content = currentContent.join("\n").trim();
    currentSection.bullets = currentContent
      .filter((l) => l.startsWith("- ") || l.startsWith("* "))
      .map((l) => l.replace(/^[-*]\s+/, "").trim());
    sections.push(currentSection);
  }

  return sections;
}

const CARD_VARIANTS = {
  "attack-surface": {
    icon: Target,
    color: "cyan",
    label: "Attack Surface",
  },
  "threat-scenarios": {
    icon: AlertTriangle,
    color: "rose",
    label: "Threat Scenarios",
  },
  exposure: {
    icon: TrendingUp,
    color: "amber",
    label: "Exposure Analysis",
  },
  hardening: {
    icon: Shield,
    color: "emerald",
    label: "Hardening Roadmap",
  },
  summary: {
    icon: Zap,
    color: "violet",
    label: "Executive Summary",
  },
};

export function ThreatBriefingCards({
  content,
  className,
}: ThreatBriefingCardsProps): React.JSX.Element {
  const sections = useMemo(() => parseBriefingMarkdown(content), [content]);

  if (sections.length === 0) {
    return (
      <div className={cn("rounded-xl border border-slate-800 bg-panel p-6", className)}>
        <p className="font-mono text-sm text-slate-500">{content}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section, index) => {
        const variant = CARD_VARIANTS[section.type] || CARD_VARIANTS.summary;
        const Icon = variant.icon;

        const severityConfig = section.severity
          ? (SEVERITY_CONFIG[section.severity] ?? DEFAULT_CONFIG)
          : (VARIANT_CONFIG[variant.color] ?? DEFAULT_CONFIG);

        return (
          <motion.div
            key={`${section.type}-${index}`}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.01, y: -2 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
            className="group relative overflow-hidden rounded-xl border p-5"
            style={{
              backgroundColor: `${severityConfig.glowColor.replace('0.3', '0.03')}`,
              borderColor: severityConfig.borderColor,
              boxShadow: `0 0 25px ${severityConfig.glowColor}, inset 0 0 30px ${severityConfig.glowColor.replace('0.3', '0.05')}`,
            }}
          >
            {/* Animated top border gradient */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${severityConfig.glowColor}, transparent)`,
              }}
            />

            {/* Corner decorations */}
            <div className={`absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 rounded-tl-lg ${severityConfig.borderColor}`} />
            <div className={`absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 rounded-tr-lg ${severityConfig.borderColor}`} />
            <div className={`absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 rounded-bl-lg ${severityConfig.borderColor}`} />
            <div className={`absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 rounded-br-lg ${severityConfig.borderColor}`} />

            {/* Card header */}
            <div className="flex items-center gap-4">
              <motion.div
                className="relative"
                whileHover={{ scale: 1.1 }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${severityConfig.glowColor}`,
                    boxShadow: `0 0 20px ${severityConfig.glowColor}`,
                  }}
                >
                  <Icon
                    className={severityConfig.textColor}
                    size={22}
                  />
                </div>
                {/* Glow ring */}
                <div
                  className="absolute inset-0 animate-pulse rounded-xl"
                  style={{
                    backgroundColor: "transparent",
                    boxShadow: `0 0 30px ${severityConfig.glowColor}`,
                    opacity: 0.5,
                  }}
                />
              </motion.div>

              <div className="flex-1">
                <span
                  className={cn(
                    "font-mono text-[10px] font-semibold uppercase tracking-[0.3em]",
                    severityConfig.textColor,
                  )}
                  style={{
                    textShadow: `0 0 10px ${severityConfig.glowColor}`,
                  }}
                >
                  {variant.label}
                </span>
                <h3 className="mt-1 font-mono text-base font-semibold text-white">
                  {section.title}
                </h3>
              </div>

              {section.severity && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="rounded-lg px-3 py-1.5"
                  style={{
                    backgroundColor: `${severityConfig.glowColor}`,
                    boxShadow: `0 0 15px ${severityConfig.glowColor}`,
                  }}
                >
                  <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wider", severityConfig.textColor)}>
                    {section.severity}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Card content */}
            <div className="mt-5">
              {/* Bullet points */}
              {section.bullets.length > 0 && (
                <ul className="space-y-3">
                  {section.bullets.map((bullet, bulletIndex) => (
                    <motion.li
                      key={bulletIndex}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.08 + bulletIndex * 0.05,
                      }}
                      className="flex items-start gap-3"
                    >
                      <div
                        className="mt-2 h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: severityConfig.glowColor,
                          boxShadow: `0 0 8px ${severityConfig.glowColor}`,
                        }}
                      />
                      <span className="font-mono text-sm leading-relaxed text-slate-300">{bullet}</span>
                    </motion.li>
                  ))}
                </ul>
              )}

              {/* Additional content */}
              {section.content && (
                <p className="mt-4 font-mono text-sm leading-relaxed text-slate-400">
                  {section.content
                    .split("\n")
                    .filter((line) => !line.startsWith("- ") && !line.startsWith("* "))
                    .join("\n")
                    .trim()}
                </p>
              )}
            </div>

            {/* Hover glow effect */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background: `radial-gradient(circle at 50% 0%, ${severityConfig.glowColor.replace('0.3', '0.1')}, transparent 60%)`,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
