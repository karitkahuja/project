// vite.config.mjs

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // 🔌 Plugins
  plugins: [react()],

  // 📁 Path Aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // 🚀 Development Server Config
  server: {
    port: 5173,
    open: true,
    fs: { strict: false },
    proxy: {
      // 🔁 Redirect all API calls to Express backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    // ✅ Support for React Router (SPA fallback)
    historyApiFallback: true,
  },

  // 🔍 Preview Build Server
  preview: {
    port: 4173,
    historyApiFallback: true,
  },

  // 📦 Build Output
  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  // 🔗 Base Public Path
  base: '/',
});
