import { cn } from "@ai-archaeologist/ui";

type GlassPanelProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "cyan" | "rose" | "violet" | "emerald" | "amber";
};

const VARIANT_COLORS = {
  cyan: {
    border: "border-cyan-500/30",
    glow: "shadow-neon-cyan",
    accent: "from-cyan-500/10",
  },
  rose: {
    border: "border-rose-500/30",
    glow: "shadow-neon-rose",
    accent: "from-rose-500/10",
  },
  violet: {
    border: "border-violet-500/30",
    glow: "shadow-neon-violet",
    accent: "from-violet-500/10",
  },
  emerald: {
    border: "border-emerald-500/30",
    glow: "shadow-neon-emerald",
    accent: "from-emerald-500/10",
  },
  amber: {
    border: "border-amber-500/30",
    glow: "shadow-neon-amber",
    accent: "from-amber-500/10",
  },
};

export function GlassPanel({
  children,
  className,
  variant = "rose",
}: GlassPanelProps): React.JSX.Element {
  const colors = VARIANT_COLORS[variant];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-black/50 p-6 backdrop-blur-xl",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-white/5 before:to-transparent before:opacity-50",
        "after:absolute after:inset-0 after:rounded-xl after:border-2 after:border-transparent",
        colors.border,
        className,
      )}
      style={{
        boxShadow: `0 0 20px rgba(${variant === 'rose' ? '244, 63, 94' : variant === 'cyan' ? '34, 211, 238' : '167, 139, 250'}, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Corner decorations */}
      <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 rounded-tl-xl border-cyan-400/40" />
      <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 rounded-tr-xl border-cyan-400/40" />
      <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 rounded-bl-xl border-cyan-400/40" />
      <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 rounded-br-xl border-cyan-400/40" />

      {/* Animated scan line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
        style={{
          animation: "scan-line 3s ease-in-out infinite",
        }}
      />

      {children}

      <style>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(300px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
