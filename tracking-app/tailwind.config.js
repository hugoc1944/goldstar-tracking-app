/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
      "./lib/**/*.{ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          brand: {
            DEFAULT: "#FFD200",
            600: "#FFBE00",
            foreground: "#FFFFFF",
          },
          background: "#F6F7F9",
          surface: "#FFFFFF",
          border: "#E6E8EB",
          text: {
            DEFAULT: "#1F2428",
            muted: "#60656C",
            inverse: "#FFFFFF",
          },
          success: { DEFAULT: "#16A34A" },
          warning: { DEFAULT: "#F59E0B" },
          danger: { DEFAULT: "#DC2626" },
          info: { DEFAULT: "#2563EB" },
        },
        boxShadow: {
          card: "0 1px 2px rgba(16, 24, 40, 0.06)",
          modal: "0 10px 40px rgba(0,0,0,0.20)",
        },
      },
    },
    plugins: [],
  };
  