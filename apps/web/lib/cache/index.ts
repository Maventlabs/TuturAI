import { createHash } from 'node:crypto'
import { getRedisClient } from '@/lib/cache/redis'

/**
 * Bumped whenever the shape of a cached payload changes so a deploy can never
 * serve pre-upgrade data to post-upgrade code.
 */
const CACHE_VERSION = 'v1'
const KEY_PREFIX = `tuturai:${CACHE_VERSION}`

/** Redis keys are capped well below this; hash anything that could be long. */
const MAX_SEGMENT_LENGTH = 80

export type CacheResult<T> = {
  value: T
  /** `hit` = served from cache, `miss` = computed by the loader this call. */
  status: 'hit' | 'miss' | 'bypass'
  /** Wall-clock ms spent inside the whole cacheAside call. */
  durationMs: number
}

export type CacheAsideOptions<T> = {
  /**
   * Logical namespace, e.g. `classrooms:teacher`. Paired with the id that
   * scopes the data (a uid, classroom id, …) this must be unique per actor.
   */
  key: string
  ttlSeconds: number
  loader: () => Promise<T>
}

/**
 * In-flight dedupe map. On a cold cache a dashboard fires several identical
 * reads at once; without this every one of them would hit Firestore. Netlify
 * Functions reuse a warm container, so this collapses concurrent misses into a
 * single origin load per key.
 */
const inFlight = new Map<string, Promise<unknown>>()

let warnedAboutRedisFailure = false

function warnOnce(cause: unknown) {
  if (warnedAboutRedisFailure) return
  warnedAboutRedisFailure = true
  const message = cause instanceof Error ? cause.message : String(cause)
  // Never log credentials — only the failure shape.
  console.warn(JSON.stringify({ event: 'cache_redis_unavailable', message }))
}

/** Reset the "warn once" latch. Test seam only. */
export function resetCacheWarningForTests() {
  warnedAboutRedisFailure = false
}

/**
 * Builds a collision-free Redis key.
 *
 * Segments are joined with `:`, so any segment that itself contains a `:`
 * would be indistinguishable from two segments. Firestore ids and uids are
 * opaque strings, so a value like `a:b` plus `c` could otherwise collapse onto
 * the same key as `a` plus `b:c` — one classroom's rows served to another.
 * Such segments are hashed, which makes the separator unambiguous.
 */
export function buildCacheKey(...segments: Array<string | number | undefined | null>): string {
  const parts = segments.map((segment) => {
    // NUL-prefixed markers can never collide with a real Firestore id, which
    // cannot contain a NUL byte.
    if (segment === undefined) return createHash('sha256').update('\u0000undefined').digest('hex').slice(0, 32)
    if (segment === null) return createHash('sha256').update('\u0000null').digest('hex').slice(0, 32)

    const value = String(segment)
    return value.length <= MAX_SEGMENT_LENGTH && !value.includes(':')
      ? value
      : createHash('sha256').update(value).digest('hex').slice(0, 32)
  })
  return [KEY_PREFIX, ...parts].join(':')
}

/**
 * Redis can return either the raw JSON string or an already-parsed value
 * depending on client serialisation settings, so accept both shapes.
 */
function decode<T>(raw: unknown): T {
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
}

async function readThrough<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<{ value: T; served: boolean }> {
  const redis = getRedisClient()
  if (!redis) return { value: await loader(), served: false }

  let raw: unknown = null
  let readFailed = false
  try {
    raw = await redis.get(key)
  } catch (cause) {
    // Network blips, quota errors, and a cold DNS all land here. Serving the
    // origin result is always correct; only latency is lost.
    readFailed = true
    warnOnce(cause)
  }

  if (!readFailed && raw !== null && raw !== undefined) {
    const wrapper = decode<{ v: T }>(raw)
    // A wrapper keeps a legitimately cached `null`/`false`/`0` distinct from
    // a cache miss, which a bare `?? null` check could not.
    if (wrapper && typeof wrapper === 'object' && 'v' in wrapper) return { value: wrapper.v, served: true }
  }

  // A loader failure is a real application error and must propagate unchanged.
  // It is deliberately not wrapped in the Redis error path: doing so would run
  // the loader a second time and report an origin failure as a cache outage.
  const value = await loader()

  if (!readFailed) {
    // Best-effort write: a cache write failure must not fail the request.
    await redis.set(key, JSON.stringify({ v: value }), { ex: ttlSeconds }).catch((cause: unknown) => warnOnce(cause))
  }
  return { value, served: false }
}

/**
 * Read-through cache with per-key stampede protection.
 *
 * Always degrades to the origin loader: an unconfigured, unreachable, or
 * failing Redis changes latency, never correctness.
 */
export async function cacheAside<T>(options: CacheAsideOptions<T>): Promise<CacheResult<T>> {
  const startedAt = Date.now()
  const redis = getRedisClient()

  if (!redis) {
    const value = await options.loader()
    return { value, status: 'bypass', durationMs: Date.now() - startedAt }
  }

  const pending = inFlight.get(options.key) as Promise<{ value: T; served: boolean }> | undefined
  if (pending) {
    // Sharing an in-flight load is a hit for latency purposes: this caller did
    // not trigger an origin read.
    const { value } = await pending
    return { value, status: 'hit', durationMs: Date.now() - startedAt }
  }

  const promise = readThrough(options.key, options.ttlSeconds, options.loader)
  inFlight.set(options.key, promise)

  try {
    const { value, served } = await promise
    return { value, status: served ? 'hit' : 'miss', durationMs: Date.now() - startedAt }
  } finally {
    inFlight.delete(options.key)
  }
}

/**
 * Deletes every key under the given namespaces.
 *
 * Used after a write so a mutation is visible on the next read instead of
 * waiting out a TTL. Scans with a MATCH pattern and deletes in batches.
 */
export async function invalidateNamespaces(...namespaces: string[]): Promise<void> {
  const redis = getRedisClient()
  if (!redis || namespaces.length === 0) return

  for (const namespace of namespaces) {
    const pattern = `${KEY_PREFIX}:${namespace}*`
    try {
      let cursor: string | number = 0
      do {
        // `@upstash/redis` SCAN resolves to a `[cursor, keys]` tuple (verified
        // against the library's own deserializer), not a `{ cursor, result }`
        // object. The loop ends only when the cursor returns to 0, which the
        // server sends back as the string "0".
        const [nextCursor, keys]: [string, string[]] = await redis.scan(cursor, { match: pattern, count: 250 })
        if (Array.isArray(keys) && keys.length > 0) {
          await redis.del(...keys)
        }
        cursor = nextCursor
        if (String(cursor) === '0') break
      } while (true)
    } catch (cause) {
      warnOnce(cause)
    }
  }
}

/** Test seam: clears in-flight dedupe state between cases. */
export function resetInFlightForTests() {
  inFlight.clear()
}
