import { defineConfig } from "vitest/config";
import base from "./vitest.config.ts";

// Explicit, fail-closed opt-in: this suite needs a fresh synthetic PostgreSQL 15.
// Ordinary pnpm test/check remains DB-free; CI runs both gates independently.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["worker/**/*.postgres.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
