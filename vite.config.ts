import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // The static GitHub Pages build lives under /<repo>/, so assets use relative URLs there.
  base: mode === "pages" ? "./" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${process.env.API_PORT || 8787}`,
    },
  },
}));
