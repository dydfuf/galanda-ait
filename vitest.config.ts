import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 테스트는 Web 타깃 기준으로 플랫폼 구현을 해석해요.
      "@platform/current": path.resolve(import.meta.dirname, "./src/platform/current.web.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
      // 테스트 환경에서는 PWA virtual 모듈이 없으므로 stub으로 대체해요.
      "virtual:pwa-register/react": path.resolve(import.meta.dirname, "./src/pwa/pwa-register.stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts", "worker/**/*.{test,spec}.ts"],
    exclude: ["repos/**", "node_modules/**", "dist/**"],
  },
});
