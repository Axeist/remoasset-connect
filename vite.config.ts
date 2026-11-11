import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function appVersionPlugin(): Plugin {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VITE_APP_VERSION ||
    `dev-${Date.now()}`;
  const payload = JSON.stringify({
    version,
    builtAt: new Date().toISOString(),
  });

  return {
    name: "app-version-json",
    config() {
      return {
        define: {
          "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
        },
      };
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === "/version.json") {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(payload);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: payload,
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), appVersionPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
