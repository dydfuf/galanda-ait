import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 테스트는 Web 타깃 기준으로 플랫폼 구현을 해석해요.
      "@platform/current": path.resolve(import.meta.dirname, "./src/platform/current.web.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["repos/**", "node_modules/**", "dist/**"],
  },
});
