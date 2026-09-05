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

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: "text-rose-400 border-rose-400/30 bg-rose-500/10",
  high: "text-amber-400 border-amber-400/30 bg-amber-500/10",
  medium: "text-orange-400 border-orange-400/30 bg-orange-500/10",
  low: "text-cyan-400 border-cyan-400/30 bg-cyan-500/10",
  info: "text-violet-400 border-violet-400/30 bg-violet-500/10",
};

function detectSeverity(line: string): SeverityLevel | undefined {
  const lowerLine = line.toLowerCase();
  if (lowerLine.includes("critical") || lowerLine.includes("severity: critical")) return "critical";
  if (lowerLine.includes("high") || lowerLine.includes("severity: high")) return "high";
  if (lowerLine.includes("medium") || lowerLine.includes("severity: medium")) return "medium";
  if (lowerLine.includes("low") || lowerLine.includes("severity: low")) return "low";
  if (lowerLine.includes("info") || lowerLine.includes("note")) return "info";
  return undefined;
}

// Helper to create a section with optional severity
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
    // Check if this is a new heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      // Save current section
      if (currentSection) {
        currentSection.content = currentContent.join("\n").trim();
        currentSection.bullets = currentContent
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .map((l) => l.replace(/^[-*]\s+/, "").trim());
        sections.push(currentSection);
      }

      const headingText = headingMatch[2]!.trim();
      const severity = detectSeverity(headingText);

      // Detect section type
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

  // Save last section
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
      <div className={cn("rounded-md border border-slate-800 bg-panel p-6", className)}>
        <p className="text-sm text-slate-500">{content}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section, index) => {
        const variant = CARD_VARIANTS[section.type] || CARD_VARIANTS.summary;
        const Icon = variant.icon;
        const severityClass = section.severity
          ? SEVERITY_COLORS[section.severity]
          : `border-${variant.color}-400/30 bg-${variant.color}-500/10`;

        return (
          <motion.div
            key={`${section.type}-${index}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className={cn(
              "overflow-hidden rounded-md border backdrop-blur-sm",
              severityClass || `border-${variant.color}-400/30 bg-${variant.color}-500/10`,
            )}
          >
            {/* Card header */}
            <div
              className={cn(
                "flex items-center gap-3 border-b border-slate-800/50 px-4 py-3",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  `bg-${variant.color}-500/20`,
                )}
              >
                <Icon
                  className={cn(`text-${variant.color}-400`)}
                  size={16}
                />
              </div>
              <div className="flex-1">
                <span
                  className={cn(
                    "text-xs font-medium uppercase tracking-wider",
                    `text-${variant.color}-400`,
                  )}
                >
                  {variant.label}
                </span>
                <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              </div>
              {section.severity && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    section.severity === "critical" && "bg-rose-500/30 text-rose-300",
                    section.severity === "high" && "bg-amber-500/30 text-amber-300",
                    section.severity === "medium" && "bg-orange-500/30 text-orange-300",
                    section.severity === "low" && "bg-cyan-500/30 text-cyan-300",
                    section.severity === "info" && "bg-violet-500/30 text-violet-300",
                  )}
                >
                  {section.severity}
                </span>
              )}
            </div>

            {/* Card content */}
            <div className="px-4 py-3">
              {/* Bullet points */}
              {section.bullets.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {section.bullets.map((bullet, bulletIndex) => (
                    <motion.li
                      key={bulletIndex}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.1 + bulletIndex * 0.05,
                      }}
                      className="flex items-start gap-2 text-sm text-slate-300"
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          `bg-${variant.color}-400`,
                        )}
                      />
                      <span>{bullet}</span>
                    </motion.li>
                  ))}
                </ul>
              )}

              {/* Additional content (non-bullet) */}
              {section.content && (
                <p className="text-sm leading-relaxed text-slate-400">
                  {section.content
                    .split("\n")
                    .filter((line) => !line.startsWith("- ") && !line.startsWith("* "))
                    .join("\n")
                    .trim()}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
