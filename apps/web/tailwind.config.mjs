/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          void: "#090D12",
          surface: "#121820",
          raised: "#1B2531",
          text: "#F2EEE5",
          muted: "#9AA6B2",
          line: "#2A3644",
          amber: "#E6A63A",
          amberink: "#1A1206",
          signal: "#54A8C8",
          safe: "#68B982",
          danger: "#D76A63",
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