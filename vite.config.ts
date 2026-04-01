/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: false,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle all deps upfront to prevent mid-session re-optimization.
    // Without this, lazy-loaded modules can discover new deps and trigger
    // a re-optimization that changes the browser hash mid-session, causing
    // two copies of React (different ?v= hashes = different ESM module instances).
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'react-router-dom',
      'dexie',
      'html5-qrcode',
    ],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/dexie')) {
            return 'vendor-dexie';
          }
          if (id.includes('node_modules/html5-qrcode')) {
            return 'vendor-qrcode';
          }
        },
      },
    },
  },
})
