import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { cn } from "@ai-archaeologist/ui";
import { CyberBackdrop } from "../cyber/CyberBackdrop.js";
import { SceneContent } from "./SceneContent.js";

type FuturisticSceneProps = {
  className?: string;
  variant?: "hero" | "ambient";
};

export function FuturisticScene({
  className,
  variant = "hero",
}: FuturisticSceneProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        variant === "ambient" && "opacity-[0.62]",
        className,
      )}
    >
      <CyberBackdrop intensity={variant} />
      <div className="grid-overlay absolute inset-0 opacity-25 mix-blend-screen" />
      <Canvas
        camera={{ fov: 55, position: [0, 0, 12] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <SceneContent variant={variant} />
        </Suspense>
      </Canvas>
    </div>
  );
}
