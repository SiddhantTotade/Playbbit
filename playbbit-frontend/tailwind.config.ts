import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#3713ec",
        "primary-light": "#6366f1",
        "primary-dark": "#2500c4",
        "brand-pink": "#ff69b4",
        "brand-orange": "#ff8c00",
        "background-light": "#f6f6f8",
        "background-dark": "#131022",
      },
      fontFamily: {
        display: ["Spline Sans", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
export default config;
