import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "light",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm vite --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/tests/ui/fixture.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
