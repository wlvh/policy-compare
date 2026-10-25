import { defineConfig } from 'vite';
export default defineConfig({
  root: 'apps/web',
  build: { outDir: '../../dist', emptyOutDir: true, target: 'es2022' },
  worker: { format: 'es' },
  server: { fs: { allow: ['../..'] } },
});
