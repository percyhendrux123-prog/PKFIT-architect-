import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

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
    rollupOptions: {
      // Multi-page React app shells. The marketing site (static HTML in
      // public/) owns the root `/`; the SPA only boots on the live funnel
      // surfaces (/standard agent, /apply + /qualifier intake). `app.html`
      // is the generic shell; `apply.html` carries the apply-specific Open
      // Graph tags. Both load the same React app; React Router renders the
      // route. Netlify _redirects maps the funnel paths to these shells.
      input: {
        app: resolve(__dirname, 'app.html'),
        apply: resolve(__dirname, 'apply.html'),
      },
    },
  },
});
