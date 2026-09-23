import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#F0B90B",
          hover: "#D4A20A"
        },
        status: {
          success: "#0ECB81",
          error: "#F6465D",
          warning: "#FCD535",
          info: "#1E90FF"
        },
        surface: {
          primary: "#0D0E12",
          secondary: "#16181D",
          tertiary: "#1E2026",
          border: "#2B313A"
        },
        content: {
          primary: "#F5F5F5",
          secondary: "#A0A5B1",
          muted: "#6B7280"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"]
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite"
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        }
      }
    }
  },
  plugins: []
};

export default config;
