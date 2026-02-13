
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths for assets on GitHub Pages
  define: {
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
