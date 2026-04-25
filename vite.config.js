import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  // Workspace package contains untranspiled JSX; let Vite handle it directly
  // rather than pre-bundling it through esbuild's commonjs path.
  optimizeDeps: {
    exclude: ['@pkfit/ui'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    commonjsOptions: {
      // Workspace package is ESM-only, skip CJS conversion attempts.
      include: [/node_modules/],
    },
  },
});
