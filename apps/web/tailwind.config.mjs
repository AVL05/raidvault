/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          void: "rgb(var(--vault-void) / <alpha-value>)",
          surface: "rgb(var(--vault-surface) / <alpha-value>)",
          raised: "rgb(var(--vault-raised) / <alpha-value>)",
          text: "rgb(var(--vault-text) / <alpha-value>)",
          muted: "rgb(var(--vault-muted) / <alpha-value>)",
          line: "rgb(var(--vault-line) / <alpha-value>)",
          amber: "rgb(var(--vault-amber) / <alpha-value>)",
          amberink: "rgb(var(--vault-amberink) / <alpha-value>)",
          signal: "rgb(var(--vault-signal) / <alpha-value>)",
          safe: "rgb(var(--vault-safe) / <alpha-value>)",
          danger: "rgb(var(--vault-danger) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        micro: "0.14em",
      },
    },
  },
  plugins: [],
}
