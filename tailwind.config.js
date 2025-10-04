/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050509",
        foreground: "#e7e7ea",
        brand: {
          500: "#6F6CFF",
          600: "#5c59ff",
          700: "#4a46f0",
        },
      },
    },
  },
  plugins: [],
};
