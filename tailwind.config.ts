import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#f7f4ef",
        ink: "#141414",
        muted: "#6c6a66",
        line: "#e5ddd1",
        accent: "#0f766e",
        danger: "#b91c1c",
      },
      boxShadow: {
        card: "0 24px 64px rgba(20, 20, 20, 0.08)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
