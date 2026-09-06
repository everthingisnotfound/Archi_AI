import { motion } from "framer-motion";
import { Activity, AlertTriangle, FileCode2, GitBranch, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@ai-archaeologist/ui";

type RepositoryRadarCardProps = {
  id: string;
  name: string;
  branch?: string | null;
  createdAt: string;
  fileCount?: number;
  findingCount?: number;
  className?: string;
};

type MetricData = {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

function MiniRadarChart({ metrics, size = 80 }: { metrics: MetricData[]; size?: number }): React.JSX.Element {
  const center = size / 2;
  const radius = size / 2 - 8;
  const numAxes = metrics.length;
  const angleStep = (Math.PI * 2) / numAxes;

  const getPoint = (index: number, value: number): { x: number; y: number } => {
    const angle = index * angleStep - Math.PI / 2;
    const distance = (value / metrics[index]!.max) * radius;
    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    };
  };

  const polygonPoints = metrics
    .map((m, i) => getPoint(i, m.value))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  const rings = [0.25, 0.5, 0.75, 1].map((scale) => {
    const ringPoints: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = center + Math.cos(angle) * radius * scale;
      const y = center + Math.sin(angle) * radius * scale;
      ringPoints.push(`${x},${y}`);
    }
    return ringPoints.join(" ");
  });

  const axes = metrics.map((metric, i) => {
    const endPoint = getPoint(i, radius);
    const labelPoint = getPoint(i, radius + 12);
    return {
      x1: center,
      y1: center,
      x2: endPoint.x,
      y2: endPoint.y,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      label: metric.label,
    };
  });

  return (
    <svg className="overflow-visible" height={size} width={size}>
      {/* Glow filter */}
      <defs>
        <filter id="radarGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid rings */}
      {rings.map((points) => (
        <polygon
          fill="none"
          points={points}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map((axis, i) => (
        <line
          key={i}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
          x1={axis.x1}
          x2={axis.x2}
          y1={axis.y1}
          y2={axis.y2}
        />
      ))}

      {/* Data polygon with glow */}
      <motion.polygon
        animate={{ points: polygonPoints }}
        fill="url(#radarGradient)"
        fillOpacity={0.25}
        filter="url(#radarGlow)"
        initial={{ points: metrics.map(() => `${center},${center}`).join(" ") }}
        points={polygonPoints}
        stroke="url(#radarGradient)"
        strokeWidth={2}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient id="radarGradient" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
      </defs>

      {/* Data points with glow */}
      {metrics.map((metric, i) => {
        const point = getPoint(i, metric.value);
        return (
          <motion.g key={i}>
            {/* Outer glow */}
            <motion.circle
              animate={{ cx: point.x, cy: point.y }}
              fill={metric.color}
              filter="url(#radarGlow)"
              initial={{ cx: center, cy: center, r: 0 }}
              r={6}
              transition={{ duration: 0.8, delay: i * 0.1 }}
            />
            {/* Inner dot */}
            <motion.circle
              animate={{ cx: point.x, cy: point.y }}
              fill={metric.color}
              initial={{ cx: center, cy: center }}
              r={2}
              transition={{ duration: 0.8, delay: i * 0.1 }}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}

export function RepositoryRadarCard({
  id,
  name,
  branch,
  createdAt,
  fileCount = 0,
  findingCount = 0,
  className,
}: RepositoryRadarCardProps): React.JSX.Element {
  // Use stable values for metrics (no random on each render)
  const activityValue = 70;
  const growthValue = 65;

  const metrics: MetricData[] = [
    {
      label: "Files",
      value: Math.min(fileCount, 100),
      max: 100,
      color: "#67e8f9",
      icon: FileCode2,
    },
    {
      label: "Findings",
      value: Math.max(0, 50 - findingCount),
      max: 50,
      color: findingCount > 10 ? "#f87171" : "#34d399",
      icon: AlertTriangle,
    },
    {
      label: "Activity",
      value: activityValue,
      max: 100,
      color: "#a78bfa",
      icon: Activity,
    },
    {
      label: "Growth",
      value: growthValue,
      max: 100,
      color: "#fbbf24",
      icon: TrendingUp,
    },
  ];

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border",
        "bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95",
        "p-5 transition-all duration-300",
        "border-cyan-500/20 hover:border-cyan-400/50",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-cyan-500/5 before:via-transparent before:to-violet-500/5 before:opacity-0 before:transition-opacity",
        "hover:before:opacity-100",
        className,
      )}
      style={{
        boxShadow: "0 0 0 1px rgba(6, 182, 212, 0.1), 0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      {/* Animated corner accents */}
      <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 rounded-tl-xl border-cyan-500/30 transition-colors group-hover:border-cyan-400/60" />
      <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 rounded-tr-xl border-cyan-500/30 transition-colors group-hover:border-cyan-400/60" />
      <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 rounded-bl-xl border-cyan-500/30 transition-colors group-hover:border-cyan-400/60" />
      <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 rounded-br-xl border-cyan-500/30 transition-colors group-hover:border-cyan-400/60" />

      {/* Background glow effect */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl transition-all duration-500 group-hover:bg-cyan-500/20 group-hover:scale-125" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl transition-all duration-500 group-hover:bg-violet-500/20" />

      {/* Holographic sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ clipPath: "inset(0 0 50% 0)" }}
        />
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Repository name with glow on hover */}
          <Link
            className="group/link block truncate font-mono text-base font-semibold tracking-wide text-slate-100 transition-all duration-300 group-hover:text-cyan-300"
            to={`/repositories/${id}`}
          >
            <span className="relative">
              {name}
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-cyan-400 to-transparent transition-all duration-300 group-hover:w-full" />
            </span>
          </Link>

          {/* Branch info */}
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <GitBranch className="shrink-0 text-cyan-500/60" size={12} />
            <span className="truncate font-mono">{branch ?? "pending"}</span>
            <span className="shrink-0 rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400/70">
              {findingCount === 0 ? "clean" : "analyzed"}
            </span>
          </div>

          {/* Metrics */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="group/metric relative rounded-lg bg-slate-800/50 p-2 text-center transition-colors hover:bg-slate-800">
              <p className="text-xl font-bold text-cyan-300 text-glow-cyan">{fileCount}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-widest text-slate-500">Files</p>
            </div>
            <div className="group/metric relative rounded-lg bg-slate-800/50 p-2 text-center transition-colors hover:bg-slate-800">
              <p
                className={cn(
                  "text-xl font-bold",
                  findingCount > 5 ? "text-rose-300 text-glow-rose" : "text-emerald-300",
                )}
              >
                {findingCount}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-widest text-slate-500">Findings</p>
            </div>
            <div className="group/metric relative rounded-lg bg-slate-800/50 p-2 text-center transition-colors hover:bg-slate-800">
              <p className="text-xl font-bold text-violet-300">
                {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-widest text-slate-500">Added</p>
            </div>
          </div>
        </div>

        {/* Radar chart with container */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/10 to-violet-500/10 blur-xl" />
          <div className="relative rounded-full border border-cyan-500/20 bg-slate-900/80 p-2">
            <MiniRadarChart metrics={metrics} size={72} />
          </div>
        </div>
      </div>

      {/* Hover indicator */}
      <motion.div
        className="mt-4 flex items-center justify-end gap-1 text-xs text-cyan-400"
        initial={{ opacity: 0, x: 10 }}
        whileHover={{ opacity: 1, x: 0 }}
      >
        <span className="font-mono uppercase tracking-wider">Access</span>
        <svg className="h-3 w-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
