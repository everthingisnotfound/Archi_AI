import react from "@vitejs/plugin-react";

import { defineConfig, type PluginOption } from "vite";

export default defineConfig({
  plugins: [react()] as PluginOption[],

  server: {
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: [
      "ai-archaeologistweb-production.up.railway.app",
    ],
  },

  preview: {
    host: "0.0.0.0",
    allowedHosts: [
      "ai-archaeologistweb-production.up.railway.app",
    ],
  },
});