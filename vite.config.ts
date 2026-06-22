import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Allow requests from these hosts
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '116.202.24.63',
      'caspa.ocrowley.com',
      'novel.ocrowley.com',
    ],
    // Disable HMR in production
    hmr: process.env.NODE_ENV !== 'production' && process.env.DISABLE_HMR !== 'true',
  },
});
