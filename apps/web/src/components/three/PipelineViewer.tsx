import { Suspense, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  PipelineScene,
  PIPELINE_NODES,
  type PipelineNode,
  type PipelineNode as PipelineNodeType,
} from "./PipelineScene.js";

// Re-export so consumers don't need to know the internal module
export { PIPELINE_NODES };
export type { PipelineNodeType as PipelineNode };

/* ─── Animated time prop bridge ──────────────────────────────────────────── */
// This inner component receives a setProgress callback and drives the animation
function AnimationBridge({
  onProgress,
}: {
  onProgress: (p: number) => void;
}): null {
  useFrame((state) => {
    onProgress(state.clock.elapsedTime % 1);
  });
  return null;
}

type PipelineViewerProps = {
  activeStage?: PipelineNode["id"] | null;
  height?: number;
};

export function PipelineViewer({
  activeStage = null,
  height = 260,
}: PipelineViewerProps): React.JSX.Element {
  const [, setProgress] = useState(0);

  const handleProgress = useCallback((p: number) => {
    setProgress(p);
  }, []);

  return (
    <div style={{ height }}>
      <Canvas
        camera={{ fov: 50, position: [0, 0, 20], near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <PipelineScene activeStage={activeStage} />
          <AnimationBridge onProgress={handleProgress} />
        </Suspense>
      </Canvas>
    </div>
  );
}
