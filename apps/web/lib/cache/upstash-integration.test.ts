// REAL-UPSTASH-CACHE-INTEGRATION
//
// Drives the real `lib/cache` implementation against the operator-provided
// Upstash instance, with a deterministic in-memory origin loader so cache
// behaviour is proven independently of Firestore (which is currently quota
// exhausted). This is NOT a production application E2E: it proves the cache
// layer, not the deployed app.
//
// The suite skips itself when credentials are absent, so a developer machine
// without Redis still runs the normal mocked unit tests.
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { cacheAside, buildCacheKey, invalidateNamespaces, resetInFlightForTests } from './index'
import { getRedisClient, setRedisClientForTests } from './redis'

try {
  process.loadEnvFile(resolve(process.cwd(), '.env.local'))
} catch {
  // No local env file: the suite skips below.
}

const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim())
// One unique namespace per run keeps reruns from colliding with stale keys.
const RUN = randomUUID().slice(0, 8)

/** Deterministic origin: an in-memory versioned value, standing in for Firestore. */
function makeOrigin(initial: string) {
  const state = { value: initial, calls: 0 }
  const loader = async () => {
    state.calls += 1
    return state.value
  }
  return {
    state,
    loader,
    set: (next: string) => { state.value = next },
  }
}

// `buildCacheKey` hashes any single segment containing ':', which would make
// the namespace unscannable. Real code always passes discrete segments, so the
// integration suite must do the same for invalidation patterns to match.
const keyFor = (...leaf: string[]) => buildCacheKey('itest', RUN, ...leaf)

describe.skipIf(!configured)('real Upstash cache integration', () => {
  beforeEach(() => {
    resetInFlightForTests()
    setRedisClientForTests(null)
  })

  it('proves the configured instance is reachable through the cache layer', async () => {
    expect(getRedisClient()).not.toBeNull()
    const { status } = await cacheAside({
      key: keyFor('reachability'),
      ttlSeconds: 30,
      loader: async () => 'reachable',
    })
    expect(status).toBe('miss')
    await invalidateNamespaces(`itest:${RUN}:reachability`)
  })

  it('calls the origin once on a miss and serves every later read from cache', async () => {
    const origin = makeOrigin('version-A')
    const namespace = `itest:${RUN}:misshit`
    const options = { key: keyFor(namespace.split(':').at(-1)!), ttlSeconds: 30, loader: origin.loader }

    const first = await cacheAside(options)
    expect(first.status).toBe('miss')
    expect(first.value).toBe('version-A')

    const second = await cacheAside(options)
    const third = await cacheAside(options)
    expect(second.status).toBe('hit')
    expect(third.status).toBe('hit')
    expect(second.value).toBe('version-A')
    // The whole point of the cache: one origin read, not three.
    expect(origin.state.calls).toBe(1)

    await invalidateNamespaces(namespace)
  })

  it('deduplicates concurrent identical misses into a single origin load', async () => {
    const origin = makeOrigin('version-A')
    const namespace = `itest:${RUN}:dedupe`
    const options = { key: keyFor(namespace.split(':').at(-1)!), ttlSeconds: 30, loader: origin.loader }

    const results = await Promise.all(Array.from({ length: 5 }, () => cacheAside(options)))

    expect(origin.state.calls).toBe(1)
    expect(results.filter((item) => item.status === 'miss')).toHaveLength(1)
    expect(results.filter((item) => item.status === 'hit')).toHaveLength(4)
    expect(results.every((item) => item.value === 'version-A')).toBe(true)

    await invalidateNamespaces(namespace)
  })

  it('serves a stale value until invalidated, then serves the fresh origin value', async () => {
    const origin = makeOrigin('version-A')
    const namespace = `itest:${RUN}:invalidation`
    const options = { key: keyFor(namespace.split(':').at(-1)!), ttlSeconds: 30, loader: origin.loader }

    await cacheAside(options)
    origin.set('version-B')

    const stale = await cacheAside(options)
    expect(stale.status).toBe('hit')
    expect(stale.value).toBe('version-A')

    await invalidateNamespaces(namespace)

    const fresh = await cacheAside(options)
    expect(fresh.status).toBe('miss')
    expect(fresh.value).toBe('version-B')
    expect(origin.state.calls).toBe(2)

    await invalidateNamespaces(namespace)
  })

  it('invalidates real Redis keys, not just the in-process view', async () => {
    const redis = getRedisClient()
    expect(redis).not.toBeNull()
    const namespace = `itest:${RUN}:physically-deleted`
    const key = keyFor('physically-deleted')

    const origin = makeOrigin('stored-in-redis')
    await cacheAside({ key, ttlSeconds: 60, loader: origin.loader })
    expect(await redis!.get(key)).not.toBeNull()

    await invalidateNamespaces(namespace)
    expect(await redis!.get(key)).toBeNull()
  })

  it('keeps users, classrooms and teachers isolated and invalidates only the target', async () => {
    const alice = makeOrigin('alice-private')
    const bob = makeOrigin('bob-private')
    const roomA = makeOrigin('room-a-roster')
    const roomB = makeOrigin('room-b-roster')

    await cacheAside({ key: keyFor('isolation', 'profile', 'alice'), ttlSeconds: 30, loader: alice.loader })
    await cacheAside({ key: keyFor('isolation', 'profile', 'bob'), ttlSeconds: 30, loader: bob.loader })
    await cacheAside({ key: keyFor('isolation', 'members', 'classroom-a'), ttlSeconds: 30, loader: roomA.loader })
    await cacheAside({ key: keyFor('isolation', 'members', 'classroom-b'), ttlSeconds: 30, loader: roomB.loader })

    // No tenant ever observes another tenant's payload.
    expect((await cacheAside({ key: keyFor('isolation', 'profile', 'alice'), ttlSeconds: 30, loader: alice.loader })).value).toBe('alice-private')
    expect((await cacheAside({ key: keyFor('isolation', 'profile', 'bob'), ttlSeconds: 30, loader: bob.loader })).value).toBe('bob-private')
    expect((await cacheAside({ key: keyFor('isolation', 'members', 'classroom-a'), ttlSeconds: 30, loader: roomA.loader })).value).toBe('room-a-roster')
    expect((await cacheAside({ key: keyFor('isolation', 'members', 'classroom-b'), ttlSeconds: 30, loader: roomB.loader })).value).toBe('room-b-roster')

    alice.set('alice-updated')
    await invalidateNamespaces(`itest:${RUN}:isolation:profile:alice`)

    // Alice's key was dropped and refetched; Bob's stayed cached and untouched.
    expect((await cacheAside({ key: keyFor('isolation', 'profile', 'alice'), ttlSeconds: 30, loader: alice.loader })).value).toBe('alice-updated')
    expect(alice.state.calls).toBe(2)
    expect((await cacheAside({ key: keyFor('isolation', 'profile', 'bob'), ttlSeconds: 30, loader: bob.loader })).value).toBe('bob-private')
    expect(bob.state.calls).toBe(1)

    await invalidateNamespaces(`itest:${RUN}:isolation:profile`, `itest:${RUN}:isolation:members`)
  })

  it('returns to the origin once the entry expires', async () => {
    const origin = makeOrigin('version-A')
    const namespace = `itest:${RUN}:expiry`
    const options = { key: keyFor('expiry'), ttlSeconds: 1, loader: origin.loader }

    expect((await cacheAside(options)).status).toBe('miss')
    expect((await cacheAside(options)).status).toBe('hit')
    expect(origin.state.calls).toBe(1)

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_400))

    expect((await cacheAside(options)).status).toBe('miss')
    expect(origin.state.calls).toBe(2)

    await invalidateNamespaces(namespace)
  })

  it('falls back to the origin when Redis is unreachable, and never invents data', async () => {
    const origin = makeOrigin('origin-truth')
    const namespace = `itest:${RUN}:failopen`
    const exploding = {
      get: () => Promise.reject(new Error('probe: simulated redis outage')),
      set: () => Promise.reject(new Error('probe: simulated redis outage')),
      del: () => Promise.reject(new Error('probe: simulated redis outage')),
      scan: () => Promise.reject(new Error('probe: simulated redis outage')),
    }

    setRedisClientForTests(exploding as never)
    resetInFlightForTests()

    const read = await cacheAside({ key: keyFor('failopen'), ttlSeconds: 30, loader: origin.loader })
    expect(read.value).toBe('origin-truth')
    expect(read.status).toBe('miss')
    expect(origin.state.calls).toBe(1)

    // A failing invalidation must not throw into the write path either.
    await expect(invalidateNamespaces(namespace)).resolves.toBeUndefined()

    setRedisClientForTests(null)
    resetInFlightForTests()
  })

  it('never turns a failing origin into a cached or fabricated payload', async () => {
    const redis = getRedisClient()
    expect(redis).not.toBeNull()
    const namespace = `itest:${RUN}:origin-failure`
    const key = keyFor('origin-failure')

    // Models Firestore being unavailable (for example an exhausted quota):
    // the origin throws and there is genuinely no user data to serve.
    const failing = vi.fn(async () => { throw new Error('RESOURCE_EXHAUSTED: Quota exceeded.') })
    await expect(cacheAside({ key, ttlSeconds: 30, loader: failing })).rejects.toThrow('Quota exceeded')

    // Nothing may be written, so a later read cannot resurrect a fake profile.
    expect(await redis!.get(key)).toBeNull()

    const recovered = vi.fn(async () => 'real-profile')
    const result = await cacheAside({ key, ttlSeconds: 30, loader: recovered })
    expect(result.status).toBe('miss')
    expect(result.value).toBe('real-profile')

    await invalidateNamespaces(namespace)
  })
})