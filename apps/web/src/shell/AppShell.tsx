import { useQuery } from "@tanstack/react-query";
import { Activity, LogOut, Search, Sparkles } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button, cn } from "@ai-archaeologist/ui";
import { FuturisticScene } from "../components/three/FuturisticScene.js";
import { getCurrentUser, logout } from "../api/auth.js";

export function AppShell(): React.JSX.Element {
  const navigate = useNavigate();
  const meQuery = useQuery({
    queryFn: getCurrentUser,
    queryKey: ["me"],
    retry: false,
  });

  const isAuthenticated = Boolean(meQuery.data?.user);

  return (
    <div className="relative min-h-screen text-slate-100">
      <FuturisticScene variant="ambient" />
      <div className="scanline-overlay crt-flicker pointer-events-none fixed inset-0 -z-[5]" />
      <div className="cyber-noise pointer-events-none fixed inset-0 -z-[4]" />
      <header
        className="sticky top-0 z-20 border-b border-rose-500/20 bg-void/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button
            className="group flex min-w-0 items-center gap-3"
            onClick={() => navigate("/")}
            type="button"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 shadow-glow-sm transition group-hover:border-rose-400/70"
            >
              <Sparkles aria-hidden="true" size={18} />
            </span>
            <span className="truncate">
              <span className="font-display text-sm font-semibold tracking-[0.18em] text-white">
                ARCHAEOLOGIST
              </span>
              <span className="hidden font-mono text-[10px] tracking-widest text-rose-300/70 sm:block">
                CLASSIFIED // SOFTWARE INTELLIGENCE
              </span>
            </span>
          </button>
          <div
            className="hidden h-9 flex-1 items-center gap-2 rounded-lg border border-rose-500/15 bg-black/40 px-3 font-mono text-sm text-slate-500 md:flex"
          >
            <Search aria-hidden="true" className="text-rose-300/50" size={16} />
            <span className="truncate">Search repositories, symbols, findings…</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-sm text-emerald-200 sm:flex">
                  <Activity aria-hidden="true" className="text-emerald-300" size={14} />
                  {meQuery.data?.user?.name}
                </span>
                <Button
                  aria-label="Sign out"
                  onClick={() => {
                    void logout().finally(() => {
                      navigate("/login");
                    });
                  }}
                  size="icon"
                  type="button"
                  variant="glass"
                >
                  <LogOut aria-hidden="true" size={18} />
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/login")} type="button" variant="neon">
                Enter
              </Button>
            )}
          </div>
        </div>
      </header>
      <main
        className={cn(
          "relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6",
          isAuthenticated ? "min-h-[calc(100vh-4rem)]" : "",
        )}
      >
        <Outlet context={{ me: meQuery.data }} />
      </main>
    </div>
  );
}
