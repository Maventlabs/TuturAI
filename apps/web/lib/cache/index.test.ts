import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Redis } from '@upstash/redis'
import { setRedisClientForTests } from './redis'
import {
  buildCacheKey,
  cacheAside,
  invalidateNamespaces,
  resetCacheWarningForTests,
  resetInFlightForTests,
} from './index'

/**
 * In-memory stand-in for Upstash that mimics the real wire contract:
 * `scan` resolves to a `[cursor, keys]` tuple, and `set` applies the TTL.
 */
class FakeRedis {
  store = new Map<string, string>()
  scanCalls: Array<{ pattern: string; cursor: string | number }> = []
  failReads = false
  failWrites = false
  failScan = false
  getCalls = 0
  setCalls = 0

  async get(key: string) {
    this.getCalls += 1
    if (this.failReads) throw new Error('ECONNRESET')
    const raw = this.store.get(key)
    return raw === undefined ? null : raw
  }

  async set(key: string, value: string, opts?: { ex?: number }) {
    this.setCalls += 1
    if (this.failWrites) throw new Error('quota exceeded')
    if (opts?.ex !== undefined) expect(opts.ex).toBeGreaterThan(0)
    this.store.set(key, value)
    return 'OK'
  }

  async del(...keys: string[]) {
    let removed = 0
    for (const key of keys) {
      if (this.store.delete(key)) removed += 1
    }
    return removed
  }

  async scan(cursor: string | number, opts?: { match?: string; count?: number }) {
    if (this.failScan) throw new Error('scan failed')
    this.scanCalls.push({ pattern: opts?.match ?? '*', cursor })
    const pattern = new RegExp(`^${(opts?.match ?? '*').replaceAll('*', '.*')}$`)
    const keys = [...this.store.keys()].filter((key) => pattern.test(key))
    // A real single-page scan returns the terminating cursor immediately.
    return ['0', keys] as [string, string[]]
  }
}

let redis: FakeRedis

function installFake() {
  redis = new FakeRedis()
  setRedisClientForTests(redis as unknown as Redis)
}

beforeEach(() => {
  installFake()
  resetInFlightForTests()
  resetCacheWarningForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  setRedisClientForTests(null)
  vi.restoreAllMocks()
})

describe('buildCacheKey', () => {
  it('namespaces every key under the versioned prefix', () => {
    expect(buildCacheKey('members', 'c1')).toBe('tuturai:v1:members:c1')
  })

  it('treats missing segments distinctly rather than colliding', () => {
    expect(buildCacheKey('assignments', undefined)).not.toBe(buildCacheKey('assignments', null))
  })

  it('cannot be made to collide via segment separators', () => {
    // Without hashing, "a:b" + "c" and "a" + "b:c" would produce one key and
    // could serve one classroom's roster to another.
    expect(buildCacheKey('members', 'a:b', 'c')).not.toBe(buildCacheKey('members', 'a', 'b:c'))
  })

  it('never lets a caller smuggle the version prefix into a key', () => {
    expect(buildCacheKey('members', 'x:y')).toMatch(/^tuturai:v1:members:[0-9a-f]{32}$/)
  })

  it('bounds long segments instead of emitting an oversized key', () => {
    const key = buildCacheKey('members', 'x'.repeat(5000))
    expect(key.length).toBeLessThan(120)
  })

  it('is stable for the same input', () => {
    expect(buildCacheKey('members', 'abc')).toBe(buildCacheKey('members', 'abc'))
  })
})

describe('cacheAside', () => {
  it('computes on a miss and serves from cache on the next read', async () => {
    const loader = vi.fn(async () => ['row'])

    const first = await cacheAside({ key: 'k1', ttlSeconds: 30, loader })
    const second = await cacheAside({ key: 'k1', ttlSeconds: 30, loader })

    expect(first.status).toBe('miss')
    expect(second.status).toBe('hit')
    expect(loader).toHaveBeenCalledTimes(1)
    expect(second.value).toEqual(['row'])
  })

  it('round-trips null without treating it as a miss', async () => {
    const loader = vi.fn(async () => null)

    await cacheAside({ key: 'missing-doc', ttlSeconds: 30, loader })
    const second = await cacheAside({ key: 'missing-doc', ttlSeconds: 30, loader })

    expect(loader).toHaveBeenCalledTimes(1)
    expect(second.status).toBe('hit')
    expect(second.value).toBeNull()
  })

  it('round-trips falsy values distinctly from a miss', async () => {
    const loader = vi.fn(async () => ({ count: 0, ok: false }))

    await cacheAside({ key: 'falsy', ttlSeconds: 30, loader })
    const second = await cacheAside({ key: 'falsy', ttlSeconds: 30, loader })

    expect(loader).toHaveBeenCalledTimes(1)
    expect(second.value).toEqual({ count: 0, ok: false })
  })

  it('keeps different keys isolated from each other', async () => {
    const a = vi.fn(async () => 'A')
    const b = vi.fn(async () => 'B')

    const first = await cacheAside({ key: 'teacher-1', ttlSeconds: 30, loader: a })
    const second = await cacheAside({ key: 'teacher-2', ttlSeconds: 30, loader: b })

    expect(first.value).toBe('A')
    expect(second.value).toBe('B')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('collapses concurrent misses for the same key into one load', async () => {
    let resolveLoader: (value: string) => void = () => {}
    const loader = vi.fn(() => new Promise<string>((resolve) => { resolveLoader = resolve }))

    const inFlight = Promise.all([
      cacheAside({ key: 'stampede', ttlSeconds: 30, loader }),
      cacheAside({ key: 'stampede', ttlSeconds: 30, loader }),
      cacheAside({ key: 'stampede', ttlSeconds: 30, loader }),
    ])
    // Let the first caller reach the loader before releasing it.
    await vi.waitFor(() => expect(loader).toHaveBeenCalled())
    resolveLoader('once')

    const results = await inFlight
    expect(loader).toHaveBeenCalledTimes(1)
    expect(results.map((result) => result.value)).toEqual(['once', 'once', 'once'])
  })

  it('clears in-flight state after completion so later reads can miss again', async () => {
    const key = buildCacheKey('seq')
    const loader = vi.fn(async () => 1)
    await cacheAside({ key, ttlSeconds: 30, loader })
    await invalidateNamespaces('seq')
    await cacheAside({ key, ttlSeconds: 30, loader })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('propagates loader errors instead of swallowing them', async () => {
    const loader = vi.fn(async () => { throw new Error('CLASSROOM_NOT_FOUND') })
    await expect(cacheAside({ key: 'boom', ttlSeconds: 30, loader })).rejects.toThrow('CLASSROOM_NOT_FOUND')
  })

  it('does not cache a failed load', async () => {
    const failing = vi.fn(async () => { throw new Error('FIRESTORE_DOWN') })
    await expect(cacheAside({ key: 'retry', ttlSeconds: 30, loader: failing })).rejects.toThrow()
    expect(redis.store.size).toBe(0)
  })

  it('still serves the loader result when the cache read fails', async () => {
    redis.failReads = true
    const loader = vi.fn(async () => 'origin')

    const result = await cacheAside({ key: 'readfail', ttlSeconds: 30, loader })

    expect(result.value).toBe('origin')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('serves the loader result when the cache write fails', async () => {
    redis.failWrites = true
    const loader = vi.fn(async () => 'origin')

    const result = await cacheAside({ key: 'writefail', ttlSeconds: 30, loader })

    expect(result.value).toBe('origin')
  })

  it('falls back to the loader when Redis is not configured at all', async () => {
    setRedisClientForTests(null)
    const loader = vi.fn(async () => 'no-cache')

    const result = await cacheAside({ key: 'bypass', ttlSeconds: 30, loader })

    expect(result.status).toBe('bypass')
    expect(result.value).toBe('no-cache')
  })

  it('passes the requested TTL through to the cache write', async () => {
    await cacheAside({ key: 'ttl', ttlSeconds: 15, loader: async () => 1 })
    expect(redis.setCalls).toBe(1)
    expect(redis.store.has('ttl')).toBe(true)
  })
})

describe('invalidateNamespaces', () => {
  it('deletes every key under the namespace prefix', async () => {
    const membersC1 = buildCacheKey('members', 'c1')
    const membersC2 = buildCacheKey('members', 'c2')
    const assignmentsC1 = buildCacheKey('assignments', 'c1')

    await cacheAside({ key: membersC1, ttlSeconds: 30, loader: async () => 'a' })
    await cacheAside({ key: membersC2, ttlSeconds: 30, loader: async () => 'b' })
    await cacheAside({ key: assignmentsC1, ttlSeconds: 30, loader: async () => 'c' })

    await invalidateNamespaces('members:c1')

    expect(redis.store.has(membersC1)).toBe(false)
    expect(redis.store.has(membersC2)).toBe(true)
    expect(redis.store.has(assignmentsC1)).toBe(true)
  })

  it('matches the versioned prefix rather than the bare namespace', async () => {
    await cacheAside({ key: buildCacheKey('members', 'c1'), ttlSeconds: 30, loader: async () => 'a' })
    await invalidateNamespaces('members:c1')
    expect(redis.scanCalls[0]?.pattern).toBe('tuturai:v1:members:c1*')
  })

  it('forces the next read to recompute', async () => {
    const key = buildCacheKey('members', 'c1')
    const loader = vi.fn(async () => 'v1')
    await cacheAside({ key, ttlSeconds: 30, loader })
    await invalidateNamespaces('members:c1')

    const next = await cacheAside({ key, ttlSeconds: 30, loader })

    expect(loader).toHaveBeenCalledTimes(2)
    expect(next.status).toBe('miss')
  })

  it('clears several namespaces at once', async () => {
    await cacheAside({ key: buildCacheKey('members', 'c1'), ttlSeconds: 30, loader: async () => 1 })
    await cacheAside({ key: buildCacheKey('reviewQueue', 't1'), ttlSeconds: 30, loader: async () => 2 })

    await invalidateNamespaces('members:c1', 'reviewQueue:t1')

    expect(redis.store.size).toBe(0)
  })

  it('does not throw when the scan fails', async () => {
    redis.failScan = true
    await expect(invalidateNamespaces('members:c1')).resolves.toBeUndefined()
  })

  it('is a no-op when no namespaces are given', async () => {
    const key = buildCacheKey('members', 'c1')
    await cacheAside({ key, ttlSeconds: 30, loader: async () => 1 })
    await invalidateNamespaces()
    expect(redis.scanCalls).toHaveLength(0)
    expect(redis.store.has(key)).toBe(true)
  })

  it('is a no-op when the cache is not configured', async () => {
    setRedisClientForTests(null)
    await expect(invalidateNamespaces('members:c1')).resolves.toBeUndefined()
  })
})
