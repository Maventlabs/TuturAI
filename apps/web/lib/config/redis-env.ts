function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

/**
 * Upstash Redis connection settings.
 *
 * The cache is an optimisation, never a dependency: when these variables are
 * absent the whole cache layer degrades to a pass-through that calls the origin
 * loader directly. That keeps local development, the Firebase emulator suite,
 * and CI working without provisioning a Redis database.
 */
export function getRedisEnv() {
  const url = optional('UPSTASH_REDIS_REST_URL')
  const token = optional('UPSTASH_REDIS_REST_TOKEN')
  const disabled = optional('CACHE_ENABLED') === 'false'

  return {
    url,
    token,
    // Both halves of the credential must be present; a half-configured cache is
    // treated as "not configured" rather than failing every request at runtime.
    enabled: !disabled && Boolean(url) && Boolean(token),
  } as const
}
