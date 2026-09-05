import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { FuturisticScene } from "../components/three/FuturisticScene.js";
import { getCurrentUser } from "../api/auth.js";

export function AuthLayout(): React.JSX.Element {
  const meQuery = useQuery({
    queryFn: getCurrentUser,
    queryKey: ["me"],
    retry: false,
  });

  if (meQuery.data?.user) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="relative min-h-screen text-slate-100">
      <FuturisticScene variant="hero" />
      <div className="scanline-overlay crt-flicker pointer-events-none fixed inset-0 -z-[5]" />
      <div className="cyber-noise pointer-events-none fixed inset-0 -z-[4]" />
      <Outlet />
    </div>
  );
}
