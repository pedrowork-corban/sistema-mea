/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        surface: { 1: "hsl(var(--surface-1))", 2: "hsl(var(--surface-2))", 3: "hsl(var(--surface-3))" },
        ma: {
          azul: "#000f30",
          amarelo: "#F6E27F",
          preto: "#1A1F16",
          cinza: "#7F7979",
          branco: "#F8F8F8",
          /* grafite quase preto com fundo azulado — base do menu flutuante */
          grafite: "#0A0D13",
          "grafite-2": "#141922",
        },
      },
      borderRadius: { sm: "6px", DEFAULT: "10px", md: "12px", lg: "16px", xl: "20px", "2xl": "24px" },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ['"Playfair Display"', "Georgia", "serif"],
        num: ['"Inter Tight"', "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,15,48,.06), 0 8px 24px -12px rgba(0,15,48,.18)",
        pop: "0 12px 40px -12px rgba(0,15,48,.35)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-in": "fade-in .18s ease-out" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
