import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { env } from "@orchard/config";

export default defineConfig({
  plugins: [react()],
  envDir: false,
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(env.API_BASE_URL),
  },
  server: {
    proxy: {
      "/api": {
        target: env.API_BASE_URL.replace(/\/api\/?$/, ""),
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
    allowedHosts: ["pomona.garden", "localhost"],
    port: Number(env.DASH_PORT),
  },
});
