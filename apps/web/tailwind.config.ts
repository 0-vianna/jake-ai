import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: "#fcf8e6",
        paper: "#fffdf4",
        ink: "#27231f",
        muted: "#756f67",
        line: "#eadfcb",
        accent: "#d97732",
        "accent-soft": "#fff1da",
        night: "#141311",
        "night-panel": "#1f1d1a"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(65, 45, 23, 0.10)",
        panel: "0 18px 60px rgba(31, 27, 23, 0.14)"
      },
      borderRadius: {
        panel: "8px"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
