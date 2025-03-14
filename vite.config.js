import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      }
    }
  },
  base: '/3d-car-combat/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
}); 