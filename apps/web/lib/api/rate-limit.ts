import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { getAdminDb } from '@/lib/firebase/admin'

export class ApiRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('API rate limit exceeded')
    this.name = 'ApiRateLimitError'
  }
}

export function rateLimitResponse(error: unknown) {
  if (!(error instanceof ApiRateLimitError)) return null
  return NextResponse.json(apiError('RATE_LIMITED', 'Too many requests. Retry after the indicated delay.', {
    retryAfterSeconds: error.retryAfterSeconds,
  }), {
    status: 429,
    headers: { 'Retry-After': String(error.retryAfterSeconds), 'Cache-Control': 'no-store' },
  })
}

export async function consumeApiRateLimit(input: {
  scope: string
  subject: string
  limit: number
  windowMs: number
  now?: number
}) {
  if (!/^[a-z][a-z0-9-]{1,48}$/.test(input.scope) || !input.subject || !Number.isInteger(input.limit) || input.limit < 1 || !Number.isInteger(input.windowMs) || input.windowMs < 1_000) {
    throw new Error('Invalid API rate limit configuration')
  }
  const now = input.now ?? Date.now()
  const id = createHash('sha256').update(`${input.scope}:${input.subject}`).digest('hex')
  const db = getAdminDb()
  const reference = db.collection('apiRateLimits').doc(id)
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference)
    const data = snapshot.data()
    const windowStartedAt = data?.windowStartedAt instanceof Timestamp ? data.windowStartedAt.toMillis() : 0
    const count = typeof data?.count === 'number' ? data.count : 0
    const expired = !snapshot.exists || now < windowStartedAt || now - windowStartedAt >= input.windowMs
    if (expired) {
      const windowStarted = Timestamp.fromMillis(now)
      transaction.set(reference, {
        scope: input.scope,
        subjectHash: id,
        count: 1,
        windowStartedAt: windowStarted,
        expiresAt: Timestamp.fromMillis(now + input.windowMs),
        updatedAt: windowStarted,
      })
      return { count: 1, retryAfterSeconds: 0 }
    }
    if (count >= input.limit) {
      return { count, retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + input.windowMs - now) / 1_000)) }
    }
    transaction.update(reference, { count: count + 1, updatedAt: Timestamp.fromMillis(now) })
    return { count: count + 1, retryAfterSeconds: 0 }
  })
  if (result.retryAfterSeconds > 0) throw new ApiRateLimitError(result.retryAfterSeconds)
  return { remaining: Math.max(0, input.limit - result.count), resetAt: now + input.windowMs }
}
