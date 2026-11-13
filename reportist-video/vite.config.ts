import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// `/studio` is the production URL for the app. Vercel rewrites it to
// studio.html; this tiny middleware mirrors that behavior in `vite dev`.
// Static hosts also resolve `/ko/` to `/ko/index.html`, so mirror that too.
function studioRewritePlugin(): Plugin {
  const localeIndex = /^\/(ko|ja|zh|es|fr|de)\/?(\?.*)?$/;

  const rewrite = (
    req: { url?: string },
    _res: unknown,
    next: () => void,
  ) => {
    if (req.url === '/studio' || req.url?.startsWith('/studio?')) {
      req.url = '/studio.html';
    } else if (req.url && localeIndex.test(req.url)) {
      const [path, query] = req.url.split('?');
      req.url = `${path.replace(/\/$/, '')}/index.html${query ? `?${query}` : ''}`;
    }
    next();
  };

  return {
    name: 'penguincut-studio-rewrite',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  appType: 'mpa',
  plugins: [react(), studioRewritePlugin()],
  build: {
    rolldownOptions: {
      input: {
        landing: `${rootDir}index.html`,
        studio: `${rootDir}studio.html`,
      },
      output: {
        // 무거운 라이브러리를 벤더로 분리해 초기 번들을 줄인다.
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
