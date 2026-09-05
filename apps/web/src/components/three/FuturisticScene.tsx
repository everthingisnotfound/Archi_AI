import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
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
          <EffectComposer>
            <Bloom
              blendFunction={BlendFunction.ADD}
              intensity={variant === "hero" ? 1.2 : 0.8}
              luminanceThreshold={0.15}
              luminanceSmoothing={0.85}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
