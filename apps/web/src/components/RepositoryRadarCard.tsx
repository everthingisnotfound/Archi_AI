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

  // Generate points for the radar polygon
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

  // Generate grid rings
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

  // Generate axis lines and labels
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
      {/* Grid rings */}
      {rings.map((points, i) => (
        <polygon
          key={i}
          fill="none"
          points={points}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map((axis, i) => (
        <line
          key={i}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
          x1={axis.x1}
          x2={axis.x2}
          y1={axis.y1}
          y2={axis.y2}
        />
      ))}

      {/* Data polygon */}
      <motion.polygon
        animate={{ points: polygonPoints }}
        fill="url(#radarGradient)"
        fillOpacity={0.3}
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
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* Data points */}
      {metrics.map((metric, i) => {
        const point = getPoint(i, metric.value);
        return (
          <motion.circle
            key={i}
            animate={{ cx: point.x, cy: point.y }}
            fill={metric.color}
            initial={{ cx: center, cy: center }}
            r={3}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          />
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
      value: Math.floor(Math.random() * 50) + 50,
      max: 100,
      color: "#a78bfa",
      icon: Activity,
    },
    {
      label: "Growth",
      value: Math.floor(Math.random() * 40) + 60,
      max: 100,
      color: "#fbbf24",
      icon: TrendingUp,
    },
  ];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-cyan-500/20",
        "bg-gradient-to-br from-slate-900/80 to-slate-950/80",
        "p-4 transition-all duration-200 hover:border-cyan-400/40 hover:shadow-lg",
        "hover:shadow-cyan-500/10",
        className,
      )}
    >
      {/* Background glow effect */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-500/5 blur-2xl transition-all duration-300 group-hover:bg-cyan-500/10" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Repository name */}
          <Link
            className="block truncate font-medium text-white transition-colors group-hover:text-cyan-300"
            to={`/repositories/${id}`}
          >
            {name}
          </Link>

          {/* Branch info */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <GitBranch className="shrink-0" size={12} />
            <span className="truncate">{branch ?? "pending"}</span>
          </div>

          {/* Metrics */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-lg font-semibold text-cyan-300">{fileCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Files</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-lg font-semibold",
                  findingCount > 5 ? "text-rose-300" : "text-emerald-300",
                )}
              >
                {findingCount}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Findings</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-violet-300">
                {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Added</p>
            </div>
          </div>
        </div>

        {/* Radar chart */}
        <div className="shrink-0">
          <MiniRadarChart metrics={metrics} size={72} />
        </div>
      </div>

      {/* Hover indicator */}
      <div className="mt-3 flex items-center gap-1 text-xs text-cyan-400 opacity-0 transition-opacity group-hover:opacity-100">
        <span>View details</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.div>
  );
}
