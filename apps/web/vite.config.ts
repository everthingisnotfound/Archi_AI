import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";

export default defineConfig({
  plugins: [react()] as PluginOption[],
  server: {
    port: 5173,
  },
});

