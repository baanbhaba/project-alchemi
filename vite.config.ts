import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env": {},
  },
  base: "./", // Use relative base path for desktop file:// protocol loading in Electron
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/nvidia-api": {
        target: "https://integrate.api.nvidia.com/v1",
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/nvidia-api/, ""),
      },
      "/aiml-api": {
        target: "https://api.aimlapi.com/v1",
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/aiml-api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
  },
} as any);
