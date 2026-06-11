import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiPort = Number(process.env.API_PORT ?? 8787);

export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
      "/ws": {
        target: `ws://127.0.0.1:${apiPort}`,
        ws: true
      }
    }
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true
  }
});
