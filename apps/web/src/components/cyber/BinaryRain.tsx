import { useEffect, useRef } from "react";
import { cn } from "@ai-archaeologist/ui";

type BinaryRainProps = {
  className?: string;
  columnWidth?: number;
  density?: number;
  opacity?: number;
  speed?: number;
};

type RainColumn = {
  chars: string[];
  head: number;
  length: number;
  speed: number;
  x: number;
};

const GLYPHS = "01";

function createColumn(x: number, rows: number, speedScale: number): RainColumn {
  const length = 8 + Math.floor(Math.random() * 18);
  return {
    chars: Array.from({ length }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0"),
    head: Math.random() * rows,
    length,
    speed: (0.35 + Math.random() * 0.85) * speedScale,
    x,
  };
}

export function BinaryRain({
  className,
  columnWidth = 18,
  density = 0.55,
  opacity = 0.22,
  speed = 1,
}: BinaryRainProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationFrame = 0;
    let columns: RainColumn[] = [];
    let rows = 0;

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }

      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      rows = Math.ceil(height / columnWidth) + 24;
      const columnCount = Math.max(8, Math.floor((width / columnWidth) * density));
      columns = Array.from({ length: columnCount }, (_, index) =>
        createColumn(index * (width / columnCount), rows, speed),
      );
    };

    const draw = (): void => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);
      context.font = `${columnWidth - 4}px "Courier New", monospace`;
      context.textBaseline = "top";

      for (const column of columns) {
        column.head += column.speed;

        if (column.head - column.length > rows) {
          column.head = -Math.random() * 12;
          column.length = 8 + Math.floor(Math.random() * 18);
          column.speed = (0.35 + Math.random() * 0.85) * speed;
        }

        for (let index = 0; index < column.length; index += 1) {
          const row = Math.floor(column.head - index);
          if (row < 0 || row >= rows) {
            continue;
          }

          if (Math.random() < 0.025) {
            column.chars[index] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0";
          }

          const y = row * columnWidth;
          const trail = index / column.length;
          const isHead = index === 0;
          const alpha = isHead
            ? opacity * 1.35
            : opacity * Math.max(0.08, 1 - trail * 0.92);

          if (isHead) {
            context.fillStyle = `rgba(251, 113, 133, ${alpha})`;
          } else if (index < 3) {
            context.fillStyle = `rgba(103, 232, 249, ${alpha})`;
          } else {
            context.fillStyle = `rgba(244, 63, 94, ${alpha * 0.45})`;
          }

          context.fillText(column.chars[index] ?? "0", column.x, y);
        }
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [columnWidth, density, opacity, speed]);

  return (
    <canvas
      aria-hidden="true"
      className={cn("absolute inset-0 h-full w-full", className)}
      ref={canvasRef}
    />
  );
}
