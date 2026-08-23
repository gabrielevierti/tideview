import { defineConfig } from "vite";

export default defineConfig({
  server: { host: true, port: 5173, strictPort: true },
  // The Even Hub webview loads the bundle from a relative path.
  base: "./",
  build: { target: "esnext", assetsDir: "assets", sourcemap: true }
});
