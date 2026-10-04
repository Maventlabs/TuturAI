import { Redis } from '@upstash/redis'
import { getRedisEnv } from '@/lib/config/redis-env'

let client: Redis | null = null
let injectedClient: Redis | null = null

/**
 * Returns a shared Upstash client, or `null` when caching is not configured.
 *
 * The cache is strictly an optimisation: a missing configuration (local dev,
 * CI, the Firebase emulator suite) returns `null` so every caller falls
 * through to its origin loader instead of failing the request.
 */
export function getRedisClient(): Redis | null {
  // An injected client wins so suites can exercise the cache without env vars.
  if (injectedClient) return injectedClient

  const env = getRedisEnv()
  if (!env.enabled || !env.url || !env.token) return null

  if (!client) {
    client = new Redis({ url: env.url, token: env.token })
  }
  return client
}

/** Test seam: lets suites install a fake client without touching env vars. */
export function setRedisClientForTests(next: Redis | null) {
  injectedClient = next
}
