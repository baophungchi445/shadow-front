import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // v0.19: the 3D graphics prototype is a separate page (proto3d.html).
      input: { main: 'index.html', proto3d: 'proto3d.html' },
      output: { manualChunks: { phaser: ['phaser'], three: ['three'] } },
    },
  },
});
