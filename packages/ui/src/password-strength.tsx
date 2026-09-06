import { motion } from "framer-motion";
import { cn } from "./cn.js";

type PasswordStrengthProps = {
  password: string;
  className?: string;
};

type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

interface StrengthCheck {
  label: string;
  met: boolean;
}

function analyzePassword(password: string): { strength: StrengthLevel; checks: StrengthCheck[] } {
  const checks: StrengthCheck[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains number", met: /\d/.test(password) },
    { label: "Contains special character", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];

  const metCount = checks.filter((c) => c.met).length;

  let strength: StrengthLevel = "empty";
  if (password.length === 0) {
    strength = "empty";
  } else if (metCount <= 2) {
    strength = "weak";
  } else if (metCount === 3) {
    strength = "fair";
  } else if (metCount === 4) {
    strength = "good";
  } else {
    strength = "strong";
  }

  return { strength, checks };
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; barColor: string }> = {
  empty: { label: "", color: "text-slate-500", barColor: "bg-slate-700" },
  weak: { label: "Weak", color: "text-rose-400", barColor: "bg-rose-500" },
  fair: { label: "Fair", color: "text-amber-400", barColor: "bg-amber-500" },
  good: { label: "Good", color: "text-cyan-400", barColor: "bg-cyan-500" },
  strong: { label: "Strong", color: "text-emerald-400", barColor: "bg-emerald-500" },
};

export function PasswordStrength({ password, className }: PasswordStrengthProps): React.JSX.Element {
  const { strength, checks } = analyzePassword(password);
  const config = STRENGTH_CONFIG[strength];
  const metCount = checks.filter((c) => c.met).length;
  const progressPercent = password.length === 0 ? 0 : (metCount / checks.length) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", config.barColor)}
          initial={{ width: "0%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Strength label and checks */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {password.length > 0 && (
            <>
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  strength === "strong" && "bg-emerald-400",
                  strength === "good" && "bg-cyan-400",
                  strength === "fair" && "bg-amber-400",
                  strength === "weak" && "bg-rose-400",
                )}
              />
              <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
            </>
          )}
        </div>

        {/* Requirements checklist */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {checks.map((check) => (
            <motion.span
              key={check.label}
              animate={{ opacity: password.length === 0 ? 0.4 : 1 }}
              className={cn(
                "flex items-center gap-1 text-[10px]",
                check.met ? "text-emerald-400" : "text-slate-500",
              )}
            >
              {check.met ? (
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full border border-slate-600" />
              )}
              {check.label.split(" ").slice(0, 2).join(" ")}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
