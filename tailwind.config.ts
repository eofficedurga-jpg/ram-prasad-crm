import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        panel: "#111a2e",
        line: "#22304d",
        brand: "#3b82f6",
      },
    },
  },
  plugins: [],
};

export default config;
