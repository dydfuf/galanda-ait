import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// https://vite.dev/config/
// 기본(dev/build)은 일반 Web/PWA이고, `--mode ait`(dev:ait/build:ait)에서만 AIT tooling을 켜요.
export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'ait' ? [aitDevtools.vite()] : []),
    tailwindcss(),
    react({
      jsxImportSource: '@emotion/react',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
}))
