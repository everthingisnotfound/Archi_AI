import { cn } from "@ai-archaeologist/ui";
import { BinaryRain } from "./BinaryRain.js";

type CyberBackdropProps = {
  className?: string;
  intensity?: "hero" | "ambient";
};

export function CyberBackdrop({
  className,
  intensity = "hero",
}: CyberBackdropProps): React.JSX.Element {
  const isHero = intensity === "hero";

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="cyber-ambient-base absolute inset-0" />
      <div className="cyber-ambient-glow absolute inset-0" />
      <div className="cyber-ambient-glow-secondary absolute inset-0" />
      <BinaryRain
        columnWidth={isHero ? 16 : 20}
        density={isHero ? 0.7 : 0.45}
        opacity={isHero ? 0.2 : 0.12}
        speed={isHero ? 1 : 0.75}
      />
      <div className="cyber-vignette absolute inset-0" />
    </div>
  );
}
