import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src',
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:   path.resolve(__dirname, 'src/index.html'),
        editor: path.resolve(__dirname, 'src/editor.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
