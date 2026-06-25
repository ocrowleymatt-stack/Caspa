import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/stats': 'http://localhost:3000',
      '/backups': 'http://localhost:3000',
      '/backup': 'http://localhost:3000',
      '/restore': 'http://localhost:3000',
      '/dropbox': 'http://localhost:3000',
      '/export': 'http://localhost:3000',
      '/import': 'http://localhost:3000',
    },
  },
});
