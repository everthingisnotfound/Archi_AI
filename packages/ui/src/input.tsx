import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn.js";

const inputVariants = cva(
  "h-10 w-full rounded-lg px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "border border-slate-700 bg-slate-950 focus:border-cyan-400 focus:ring-cyan-300/20",
        glass:
          "border border-cyan-400/15 bg-black/30 backdrop-blur-sm focus:border-cyan-400/60 focus:ring-cyan-300/15",
      },
    },
  },
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, ...props }, ref) => (
    <input className={cn(inputVariants({ className, variant }))} ref={ref} {...props} />
  ),
);

Input.displayName = "Input";
