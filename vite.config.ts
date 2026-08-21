import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// https://vite.dev/config/
// 기본(dev/build)은 일반 Web/PWA이고, `--mode ait`(dev:ait/build:ait)에서만 AIT tooling을 켜요.
export default defineConfig(({ mode }) => {
  const isAitTarget = mode === 'ait'

  return {
    plugins: [
      ...(isAitTarget ? [aitDevtools.vite()] : []),
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
      },
    },
  }
})
