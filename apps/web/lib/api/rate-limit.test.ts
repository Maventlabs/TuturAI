import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

const { getAdminDb } = vi.hoisted(() => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))

import { ApiRateLimitError, consumeApiRateLimit } from './rate-limit'

describe('consumeApiRateLimit', () => {
  let documents: Map<string, Record<string, unknown>>

  beforeEach(() => {
    documents = new Map()
    getAdminDb.mockReturnValue({
      collection: () => ({
        doc: (id: string) => ({ id, path: `apiRateLimits/${id}` }),
      }),
      runTransaction: async (action: (transaction: unknown) => Promise<unknown>) => action({
        get: async (reference: { id: string }) => {
          const data = documents.get(reference.id)
          return { exists: Boolean(data), data: () => data }
        },
        set: (reference: { id: string }, data: Record<string, unknown>) => { documents.set(reference.id, data) },
        update: (reference: { id: string }, data: Record<string, unknown>) => {
          documents.set(reference.id, { ...documents.get(reference.id), ...data })
        },
      }),
    })
  })

  it('allows the configured amount then reports a bounded retry-after interval', async () => {
    const options = { scope: 'pronunciation', subject: 'student-private-id', limit: 2, windowMs: 60_000, now: 1_000_000 }
    await expect(consumeApiRateLimit(options)).resolves.toMatchObject({ remaining: 1 })
    await expect(consumeApiRateLimit(options)).resolves.toMatchObject({ remaining: 0 })
    await expect(consumeApiRateLimit(options)).rejects.toMatchObject({
      name: 'ApiRateLimitError',
      retryAfterSeconds: 60,
    } satisfies Partial<ApiRateLimitError>)
    expect(JSON.stringify([...documents.values()])).not.toContain('student-private-id')
  })

  it('starts a fresh window after expiry', async () => {
    const options = { scope: 'voice-enrollment', subject: 'teacher-private-id', limit: 1, windowMs: 60_000, now: 10_000 }
    await consumeApiRateLimit(options)
    await expect(consumeApiRateLimit({ ...options, now: 70_000 })).resolves.toMatchObject({ remaining: 0 })
  })

  it('rejects an invalid rate-limit scope before creating a document', async () => {
    await expect(consumeApiRateLimit({ scope: '../../users', subject: 'student', limit: 1, windowMs: 60_000 })).rejects.toThrow('Invalid API rate limit configuration')
    expect(documents.size).toBe(0)
  })

  it('stores Firestore timestamps rather than client-provided text values', async () => {
    await consumeApiRateLimit({ scope: 'drive-upload', subject: 'teacher-private-id', limit: 2, windowMs: 60_000, now: 123_000 })
    const record = [...documents.values()][0]
    expect(record.windowStartedAt).toBeInstanceOf(Timestamp)
    expect(record.expiresAt).toBeInstanceOf(Timestamp)
  })
})
