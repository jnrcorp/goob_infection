import { defineConfig } from 'vite';

export default defineConfig({
  // Same port as the old serve.py, so bookmarked debug URLs keep working.
  server: { port: 8000, strictPort: true },
  preview: { port: 8000, strictPort: true },
  // main.js uses top-level await.
  // One ~850 kB bundle, most of it Three.js; fine for a game.
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
