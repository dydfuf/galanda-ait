import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

/*
 * Vite dev server는 SPA만 서빙해요. `/api/*`는 Worker(Hono)가 소유하므로
 * dev에서도 로컬 `wrangler dev`로 그대로 넘겨요.
 * proxy가 없으면 `/api/*` 요청이 SPA fallback HTML을 받아 로그인/세션이 조용히 깨져요.
 * production에서는 Cloudflare assets의 `run_worker_first: ["/api/*"]`가 같은 역할을 해요.
 */
const DEV_API_TARGET = process.env.GALANDA_DEV_API_TARGET ?? 'http://127.0.0.1:8787'

// https://vite.dev/config/
// 기본(dev/build)은 일반 Web/PWA이고, `--mode ait`(dev:ait/build:ait)에서만 AIT tooling을 켜요.
export default defineConfig(({ mode }) => {
  const isAitTarget = mode === 'ait'

  return {
    server: {
      proxy: {
        '/api': {
          target: DEV_API_TARGET,
          /*
           * Origin/Host를 그대로 전달해요.
           * Better Auth는 `BETTER_AUTH_URL`을 baseURL/trustedOrigin으로 사용하므로
           * dev에서는 브라우저가 보는 origin(기본 http://localhost:5173)과 맞춰야 해요.
           */
          changeOrigin: false,
        },
      },
    },
    plugins: [
      ...(isAitTarget
        ? [aitDevtools.vite()]
        : [
            VitePWA({
              registerType: 'prompt',
              injectRegister: 'auto',
              strategies: 'generateSW',
              includeAssets: ['favicon.svg'],
              manifest: {
                name: '갈란다 - 친구들과 함께하는 여행 일정 조율',
                short_name: '갈란다',
                description: '갈란다 - 친구들과 함께하는 여행 일정 조율',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                theme_color: '#3182f6',
                background_color: '#ffffff',
                lang: 'ko',
                icons: [
                  {
                    src: 'pwa/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: 'pwa/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                  {
                    src: 'pwa/icon-maskable-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                  {
                    urlPattern: /^.*\/api\/.*$/,
                    handler: 'NetworkOnly',
                  },
                ],
                cleanupOutdatedCaches: true,
                clientsClaim: false,
                skipWaiting: false,
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
              },
              devOptions: {
                enabled: false,
              },
              pwaAssets: {
                disabled: true,
              },
            }),
          ]),
      tailwindcss(),
      react({
        jsxImportSource: '@emotion/react',
      }),
    ],
    resolve: {
      alias: {
        /*
         * 플랫폼 구현을 빌드 타임에 고정해요.
         * Web 빌드는 current.web만 import하므로 `@apps-in-toss/*`가 번들에 들어가지 않아요.
         * (런타임 분기로는 tree-shaking이 되지 않아요.)
         */
        '@platform/current': path.resolve(
          import.meta.dirname,
          isAitTarget ? './src/platform/current.ait.ts' : './src/platform/current.web.ts',
        ),
        '@': path.resolve(import.meta.dirname, './src'),
        ...(isAitTarget
          ? {
              // AIT 빌드에서는 PWA virtual 모듈이 없으므로 stub으로 대체해요.
              'virtual:pwa-register/react': path.resolve(
                import.meta.dirname,
                './src/pwa/pwa-register.stub.ts',
              ),
            }
          : {}),
      },
    },
  }
})
