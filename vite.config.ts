import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/dice-delve/',
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkFileNames: 'assets/[name]-[hash].js',
  },
  server: { host: '127.0.0.1', port: 5173 },
});
