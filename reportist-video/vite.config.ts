import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 자주 함께 쓰이는 대형 벤더는 별도 청크로 분리해 초기 번들을 줄인다.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 15 },
            { name: 'gsap', test: /node_modules[\\/]gsap[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    port: 5175,
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
