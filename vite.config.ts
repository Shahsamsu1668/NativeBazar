import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/NativeBazar/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-404-for-github-pages',
        closeBundle() {
          const distIndex = path.resolve('dist', 'index.html');
          const dist404 = path.resolve('dist', '404.html');
          if (fs.existsSync(distIndex)) {
            fs.copyFileSync(distIndex, dist404);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
