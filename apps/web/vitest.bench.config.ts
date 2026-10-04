import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Benchmark-only config.
 *
 * `vitest.config.ts` excludes `scripts/cache-benchmark.test.ts` because it
 * performs live production reads. This config includes it and nothing else, so
 * the benchmark can never be triggered by an ordinary `pnpm test`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    include: ['scripts/cache-benchmark.test.ts'],
    testTimeout: 600_000,
    exclude: [...configDefaults.exclude],
  },
})
