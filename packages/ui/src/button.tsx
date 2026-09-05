import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn.js";

const buttonVariants = cva(
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-50",
  {
    defaultVariants: {
      size: "default",
      variant: "primary",
    },
    variants: {
      size: {
        default: "h-10 px-4",
        icon: "h-10 w-10 px-0",
        sm: "h-8 px-3 text-xs",
      },
      variant: {
        glass:
          "border-cyan-400/20 bg-white/5 text-cyan-100 backdrop-blur-md hover:border-cyan-400/40 hover:bg-cyan-400/10",
        ghost: "text-slate-300 hover:bg-slate-800 hover:text-white",
        neon: "bg-rose-500 text-slate-950 shadow-danger hover:bg-rose-400 hover:shadow-glow-sm",
        outline: "border-slate-700 bg-slate-950 text-slate-100 hover:border-cyan-400",
        primary: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
        subtle: "bg-slate-800 text-slate-100 hover:bg-slate-700",
      },
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        className={cn(buttonVariants({ className, size, variant }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

