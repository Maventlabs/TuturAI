import { resolveEnv } from './env'

const CREDENTIAL_PAIRS = [
  ['UPSTASH_REDIS_REST_URL_3', 'UPSTASH_REDIS_REST_TOKEN_3'],
  ['UPSTASH_REDIS_REST_URL_2', 'UPSTASH_REDIS_REST_TOKEN_2'],
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
] as const

/**
 * Upstash Redis connection settings.
 *
 * The cache is an optimisation, never a dependency: when these variables are
 * absent the whole cache layer degrades to a pass-through that calls the origin
 * loader directly. That keeps local development, the Firebase emulator suite,
 * and CI working without provisioning a Redis database.
 *
 * Several rotated databases are configured and some entries are stored as
 * `process.env.OTHER_NAME` aliases, so the first pair whose URL and token both
 * resolve to real values wins. A retired database or a broken alias therefore
 * cannot disable the cache.
 */
export function getRedisEnv() {
  const pair = CREDENTIAL_PAIRS
    .map(([urlName, tokenName]) => ({ url: resolveEnv(urlName), token: resolveEnv(tokenName) }))
    .find((candidate) => candidate.url && candidate.token)

  const disabled = resolveEnv('CACHE_ENABLED') === 'false'

  return {
    url: pair?.url,
    token: pair?.token,
    // Both halves of the credential must be present; a half-configured cache is
    // treated as "not configured" rather than failing every request at runtime.
    enabled: !disabled && Boolean(pair?.url) && Boolean(pair?.token),
  } as const
}
