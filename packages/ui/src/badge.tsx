import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn.js";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-1 text-xs font-medium ring-1 ring-inset",
  {
    defaultVariants: {
      variant: "neutral",
    },
    variants: {
      variant: {
        cyan: "bg-cyan-400/10 text-cyan-200 ring-cyan-300/30",
        neutral: "bg-slate-800 text-slate-300 ring-slate-700",
        success: "bg-emerald-400/10 text-emerald-200 ring-emerald-300/30",
        danger: "bg-rose-500/15 text-rose-200 ring-rose-400/40",
      },
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ className, variant }))} {...props} />;
}

