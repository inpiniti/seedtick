import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/v1': {
        target: 'https://seedtick-ai-gateway.vercel.app',
        changeOrigin: true,
      },
      '/health': {
        target: 'https://seedtick-ai-gateway.vercel.app',
        changeOrigin: true,
      },
    },
  },
});
