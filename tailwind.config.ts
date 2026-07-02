import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Múul brand tokens
        tinta: {
          DEFAULT: "#0A0E1A",
          2: "#161B2E",
        },
        hueso: {
          DEFAULT: "#F4EFE6",
          2: "#ECE5D6",
        },
        turquesa: {
          DEFAULT: "#1AB6A8",
          deep: "#0E8478",
          soft: "rgba(26, 182, 168, 0.08)",
        },
        coral: {
          DEFAULT: "#FF6B47",
          soft: "rgba(255, 107, 71, 0.08)",
        },
        oro: {
          DEFAULT: "#E8B547",
        },

        // Functional aliases (shadcn-friendly)
        background: "#F4EFE6",
        foreground: "#0A0E1A",
        muted: { DEFAULT: "#ECE5D6", foreground: "#5C5C58" },
        border: "rgba(10, 14, 26, 0.10)",
        input: "rgba(10, 14, 26, 0.10)",
        ring: "#1AB6A8",
        primary: { DEFAULT: "#0A0E1A", foreground: "#F4EFE6" },
        secondary: { DEFAULT: "#1AB6A8", foreground: "#0A0E1A" },
        accent: { DEFAULT: "#FF6B47", foreground: "#F4EFE6" },
        destructive: { DEFAULT: "#DC2626", foreground: "#F4EFE6" },
        card: { DEFAULT: "#FFFFFF", foreground: "#0A0E1A" },
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      letterSpacing: {
        display: "-0.03em",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
