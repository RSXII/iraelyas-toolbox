import { defineConfig } from "vite";
import path from "path";
import { createRequire } from "module";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  root: "src",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/index.html"),
        editor: path.resolve(__dirname, "src/editor.html"),
        treeEditor: path.resolve(__dirname, "src/tree-editor.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
