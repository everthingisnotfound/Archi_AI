import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07040a",
        panel: "#120814",
        void: "#050208",
        glow: "#22d3ee",
        neon: "#67e8f9",
        violet: "#f472b6",
        blood: "#fb7185",
      },
      fontFamily: {
        display: ["Orbitron", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Share Tech Mono", "ui-monospace", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(244, 63, 94, 0.18), 0 0 80px rgba(34, 211, 238, 0.12)",
        "glow-sm": "0 0 20px rgba(244, 63, 94, 0.25)",
        neon: "0 0 24px rgba(103, 232, 249, 0.45)",
        danger: "0 0 28px rgba(244, 63, 94, 0.28)",
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        shimmer: "shimmer 8s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% center" },
          "50%": { backgroundPosition: "100% center" },
          "100%": { backgroundPosition: "0% center" },
        },
      },
    },
  },
} satisfies Config;
