import { cn } from "@ai-archaeologist/ui";

type GlassPanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function GlassPanel({ children, className }: GlassPanelProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-xl border border-rose-500/25 bg-black/40 p-6 shadow-danger backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
