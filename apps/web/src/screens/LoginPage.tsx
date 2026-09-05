import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, LogIn, Shield, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loginRequestSchema, passwordPolicy, registerRequestSchema } from "@ai-archaeologist/shared/client";
import { Button, Input } from "@ai-archaeologist/ui";
import { GlassPanel } from "../components/GlassPanel.js";
import { login, register } from "../api/auth.js";

type Mode = "login" | "register";

const featureItems = [
  "Deep codebase ingestion from GitHub, ZIP, or local folders",
  "Static analysis with symbol graphs and dependency mapping",
  "AI-powered summaries, findings, and contextual chat",
];

export function LoginPage(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const authMutation = useMutation({
    mutationFn: () =>
      mode === "login"
        ? login({ email, password })
        : register({ email, name, organizationName, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);

    const payload =
      mode === "login"
        ? { email, password }
        : { email, name, organizationName, password };
    const schema = mode === "login" ? loginRequestSchema : registerRequestSchema;
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      setFormError(
        validation.error.issues
          .map((issue) => issue.message)
          .join(" "),
      );
      return;
    }

    authMutation.mutate();
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_420px]">
        <motion.section
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
          initial={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-100">
            <Cpu aria-hidden="true" size={14} />
            Future of code intelligence
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold leading-tight tracking-wide sm:text-5xl lg:text-6xl">
              <span className="glitch-title text-gradient-shimmer" data-text="ARCHAEOLOGIST">
                ARCHAEOLOGIST
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300">
              Decode legacy systems, map hidden architecture, and interrogate production codebases
              with AI — built for the era beyond Mythos.
            </p>
          </div>

          <ul className="space-y-3">
            {featureItems.map((item, index) => (
              <motion.li
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 text-sm text-slate-400"
                initial={{ opacity: 0, x: -12 }}
                key={item}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Shield
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-cyan-400/80"
                  size={16}
                />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <GlassPanel className="shadow-glow">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.25em] text-cyan-300/70">
                  Secure access
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {mode === "login" ? "Sign in" : "Create workspace"}
                </h2>
              </div>
              <div className="grid grid-cols-2 rounded-lg border border-cyan-400/15 bg-black/30 p-1">
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                    mode === "login"
                      ? "bg-cyan-400/20 text-cyan-100 shadow-neon"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  onClick={() => {
                    setFormError(null);
                    setMode("login");
                  }}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                    mode === "register"
                      ? "bg-cyan-400/20 text-cyan-100 shadow-neon"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  onClick={() => {
                    setFormError(null);
                    setMode("register");
                  }}
                  type="button"
                >
                  Create
                </button>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <AnimatePresence initial={false} mode="popLayout">
                {mode === "register" ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                    exit={{ opacity: 0, y: -8 }}
                    initial={{ opacity: 0, y: 8 }}
                  >
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Name</span>
                      <Input
                        autoComplete="name"
                        onChange={(event) => { setName(event.target.value); }}
                        value={name}
                        variant="glass"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Organization
                      </span>
                      <Input
                        autoComplete="organization"
                        onChange={(event) => { setOrganizationName(event.target.value); }}
                        value={organizationName}
                        variant="glass"
                      />
                    </label>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Email</span>
                <Input
                  autoComplete="email"
                  onChange={(event) => { setEmail(event.target.value); }}
                  type="email"
                  value={email}
                  variant="glass"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Password</span>
                <Input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={passwordPolicy.minLength}
                  onChange={(event) => { setPassword(event.target.value); }}
                  type="password"
                  value={password}
                  variant="glass"
                />
                <span className="text-xs text-slate-500">
                  Minimum {passwordPolicy.minLength} characters for secure access.
                </span>
              </label>

              {formError ?? authMutation.error ? (
                <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                  {formError ?? authMutation.error?.message}
                </div>
              ) : null}

              <Button
                className="w-full font-medium uppercase tracking-wider"
                disabled={authMutation.isPending}
                type="submit"
                variant="neon"
              >
                {mode === "login" ? (
                  <LogIn aria-hidden="true" size={17} />
                ) : (
                  <UserPlus aria-hidden="true" size={17} />
                )}
                {authMutation.isPending
                  ? "Authenticating…"
                  : mode === "login"
                    ? "Enter system"
                    : "Initialize workspace"}
              </Button>
            </form>
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}
