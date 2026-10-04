import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Real-Upstash integration config.
 *
 * `vitest.config.ts` excludes `lib/cache/upstash-integration.test.ts` because it
 * talks to the live Upstash instance. This config includes it and nothing else,
 * so an ordinary `vitest run` stays hermetic: a Redis outage must not turn the
 * unit suite red, and a routine test run must not spend the operator's Free-tier
 * request quota.
 *
 * Run it deliberately with `pnpm cache:upstash`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/cache/upstash-integration.test.ts'],
    testTimeout: 60_000,
    exclude: [...configDefaults.exclude],
  },
})