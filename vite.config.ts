import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("lightweight-charts")) {
            return "vendor-lightweight-charts";
          }
          if (
            id.includes("recharts") ||
            id.includes("/d3-")
          ) {
            return "vendor-recharts";
          }
          if (
            id.includes("react-router") ||
            id.includes("/react/") ||
            id.includes("/react-dom/")
          ) {
            return "vendor-react";
          }
          if (
            id.includes("zustand") ||
            id.includes("date-fns") ||
            id.includes("lucide-react") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge")
          ) {
            return "vendor-utils";
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
