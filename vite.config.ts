import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * `base` is driven by an env var so the same build works on:
 *   - a custom domain / Netlify / Vercel / Docker  -> BASE_PATH="/"
 *   - GitHub Pages project site                    -> BASE_PATH="/<repo-name>/"
 * The GitHub Actions workflow sets it automatically.
 */
export default defineConfig(() => ({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /**
         * Keep the heavy, rarely-changing engines in their own cacheable
         * chunks so the initial dashboard paint stays small and fast.
         * Rollup 5 only accepts the function form.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return 'react';
          if (id.includes('bwip-js')) return 'barcode';
          if (id.includes('qrcode')) return 'qr';
          if (/jspdf|jszip|file-saver/.test(id)) return 'exporters';
          if (/papaparse|xlsx/.test(id)) return 'data';
          return;
        },
      },
    },
  },
}));
