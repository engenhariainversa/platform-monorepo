import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface & Background
        surface: {
          DEFAULT: "#021525",
          dim: "#021525",
          bright: "#293b4d",
        },
        "surface-container": {
          lowest: "#000f1e",
          low: "#091d2e",
          DEFAULT: "#0e2132",
          high: "#192b3d",
          highest: "#243648",
        },
        "on-surface": {
          DEFAULT: "#d1e4fb",
          variant: "#dcc1b1",
        },
        "inverse-surface": "#d1e4fb",
        "inverse-on-surface": "#203243",
        background: "#021525",
        "on-background": "#d1e4fb",
        "surface-variant": "#243648",
        "surface-tint": "#ffb783",

        // Outline
        outline: {
          DEFAULT: "#a48c7d",
          variant: "#564337",
        },

        // Primary (Orange)
        primary: {
          DEFAULT: "#ffb783",
          container: "#e67e22",
          fixed: "#ffdcc5",
          "fixed-dim": "#ffb783",
        },
        "on-primary": {
          DEFAULT: "#4f2500",
          container: "#502600",
          fixed: "#301400",
          "fixed-variant": "#713700",
        },
        "inverse-primary": "#944a00",

        // Secondary (Yellow)
        secondary: {
          DEFAULT: "#ffdd74",
          container: "#ebbf01",
          fixed: "#ffe084",
          "fixed-dim": "#eec209",
        },
        "on-secondary": {
          DEFAULT: "#3c2f00",
          container: "#624e00",
          fixed: "#231b00",
          "fixed-variant": "#574500",
        },

        // Tertiary (Blue)
        tertiary: {
          DEFAULT: "#92ccff",
          container: "#3fa0e4",
          fixed: "#cce5ff",
          "fixed-dim": "#92ccff",
        },
        "on-tertiary": {
          DEFAULT: "#003351",
          container: "#003452",
          fixed: "#001d31",
          "fixed-variant": "#004b73",
        },

        // Error
        error: {
          DEFAULT: "#ffb4ab",
          container: "#93000a",
        },
        "on-error": {
          DEFAULT: "#690005",
          container: "#ffdad6",
        },
      },

      // Spacing (8px base)
      spacing: {
        xs: "4px",
        sm: "12px",
        base: "8px",
        md: "24px",
        lg: "48px",
        xl: "80px",
        gutter: "16px",
        "margin-mobile": "20px",
        "margin-desktop": "64px",
      },

      // Typography
      fontFamily: {
        headline: ["Sora", "sans-serif"],
        body: ["JetBrains Mono", "monospace"],
        label: ["Hanken Grotesk", "sans-serif"],
        code: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "headline-xl": [
          "48px",
          {
            lineHeight: "56px",
            letterSpacing: "-0.02em",
            fontWeight: "800",
          },
        ],
        "headline-lg": [
          "32px",
          {
            lineHeight: "40px",
            letterSpacing: "-0.01em",
            fontWeight: "700",
          },
        ],
        "headline-lg-mobile": [
          "28px",
          {
            lineHeight: "36px",
            fontWeight: "700",
          },
        ],
        "body-md": [
          "16px",
          {
            lineHeight: "24px",
            fontWeight: "400",
          },
        ],
        "label-md": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "600",
          },
        ],
        "code-sm": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "500",
          },
        ],
      },

      // Border Radius — tight, disciplined corners
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },

      // Animations
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
