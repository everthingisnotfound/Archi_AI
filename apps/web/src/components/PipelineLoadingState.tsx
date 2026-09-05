import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PipelineViewer, PIPELINE_NODES } from "./three/PipelineViewer.js";

type PipelineLoadingStateProps = {
  message?: string;
  activeStage?: number;
  showProgress?: boolean;
  className?: string;
};

const LOADING_MESSAGES = [
  "Initializing scanner protocols...",
  "Mapping dependency graph...",
  "Parsing source files...",
  "Running threat analysis...",
  "Generating intelligence report...",
  "Calibrating threat vectors...",
];

export function PipelineLoadingState({
  message,
  activeStage = 0,
  showProgress = true,
  className,
}: PipelineLoadingStateProps): React.JSX.Element {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + Math.random() * 15 + 5;
      });
    }, 400);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const displayMessage = message ?? LOADING_MESSAGES[currentMessageIndex];
  const clampedProgress = Math.min(Math.round(progress), 100);
  const activeNodeIndex = Math.floor((activeStage / PIPELINE_NODES.length) * PIPELINE_NODES.length);

  return (
    <div className={`relative ${className}`}>
      {/* 3D Pipeline Scene */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-950/80">
        <PipelineViewer
          activeStage={PIPELINE_NODES[activeNodeIndex]?.id ?? null}
          height={200}
        />

        {/* Scanline overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="scanline-overlay crt-flicker opacity-30" />
        </div>

        {/* Node labels */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-around px-4">
          {PIPELINE_NODES.slice(0, 4).map((node, index) => (
            <div
              key={node.id}
              className="flex flex-col items-center"
            >
              <span
                className="mb-0.5 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                style={{
                  borderColor: node.color,
                  color: node.color,
                  backgroundColor: index <= activeNodeIndex ? `${node.color}20` : "transparent",
                }}
              >
                {node.label}
              </span>
            </div>
          ))}
        </div>

        {/* Corner decorations */}
        <div className="absolute left-0 top-0 h-4 w-4 border-l border-t border-cyan-500/40" />
        <div className="absolute right-0 top-0 h-4 w-4 border-r border-t border-cyan-500/40" />
        <div className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-cyan-500/40" />
        <div className="absolute bottom-0 right-0 h-4 w-4 border-b border-r border-cyan-500/40" />
      </div>

      {/* Status panel */}
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Pulsing indicator */}
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                className="h-3 w-3 rounded-full bg-cyan-400"
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-cyan-400/50" />
            </div>

            {/* Message */}
            <div>
              <motion.p
                animate={{ opacity: [1, 0.5, 1] }}
                className="font-mono text-sm text-cyan-300"
                transition={{ duration: 2, repeat: Infinity }}
                key={displayMessage}
              >
                {displayMessage}
              </motion.p>
              <p className="mt-0.5 text-xs text-slate-500">
                Processing stage {activeStage + 1} of {PIPELINE_NODES.length}
              </p>
            </div>
          </div>

          {/* Progress */}
          {showProgress && (
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-white">
                {clampedProgress}
                <span className="text-sm text-slate-500">%</span>
              </p>
              <p className="text-xs text-slate-500">Complete</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                animate={{ width: `${clampedProgress}%` }}
                initial={{ width: "0%" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-600">
              <span>Initializing</span>
              <span>Processing</span>
              <span>Complete</span>
            </div>
          </div>
        )}
      </div>

      {/* Glitch effect on edges */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
    </div>
  );
}
