import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import zaloMiniApp from 'zmp-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    zaloMiniApp()
  ],
  server: {
    port: 3000,
    host: true
  }
});
