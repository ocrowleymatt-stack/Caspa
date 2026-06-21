import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'firebase/auth': path.resolve(__dirname, 'src/lib/localAuth.ts'),
      'firebase/firestore': path.resolve(__dirname, 'src/lib/localFirestore.ts'),
    },
  },
  server: {
    allowedHosts: ['novel.ocrowley.com', 'localhost', '116.202.24.63'],
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
