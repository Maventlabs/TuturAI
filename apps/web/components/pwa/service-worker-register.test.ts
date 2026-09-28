import { describe, expect, it } from 'vitest'
import { ensureReplayResponse } from './service-worker-register'

describe('offline replay response policy', () => {
  it('keeps provider and rate-limit responses retryable', async () => {
    await expect(ensureReplayResponse(new Response(JSON.stringify({ error: { details: { code: 'RATE_LIMITED' } } }), { status: 429 }), 'replay failed'))
      .rejects.toMatchObject({ name: 'OfflineMutationError', retryable: true })
    await expect(ensureReplayResponse(new Response(JSON.stringify({ error: { details: { code: 'DRIVE_NOT_CONNECTED', retryable: true } } }), { status: 503 }), 'replay failed'))
      .rejects.toMatchObject({ name: 'OfflineMutationError', retryable: true })
  })

  it('marks permanent authorization and idempotency conflicts as non-retryable', async () => {
    await expect(ensureReplayResponse(new Response(JSON.stringify({ error: { details: { code: 'IDEMPOTENCY_KEY_REUSED' } } }), { status: 409 }), 'replay failed'))
      .rejects.toMatchObject({ name: 'OfflineMutationError', retryable: false })
  })

  it('accepts confirmed successful responses', async () => {
    await expect(ensureReplayResponse(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }), 'replay failed')).resolves.toBeUndefined()
  })
})
