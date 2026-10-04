import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    // `scripts/e2e-prod-*.test.mjs` are node:test suites (run via `node --test`),
    // not vitest suites — vitest would otherwise fail them with
    // "No test suite found" despite them passing under their real runner.
    // `scripts/cache-benchmark.test.ts` performs live production reads and is
    // run deliberately via `pnpm cache:bench`.
    exclude: [...configDefaults.exclude, 'scripts/e2e-prod-*.test.mjs', 'scripts/cache-benchmark.test.ts'],
  },
})
