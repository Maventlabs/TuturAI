import { describe, expect, it } from 'vitest'
import { enqueueMutation, updateMutationStatus } from './sync'

describe('sync queue', () => {
  it('deduplicates retries with the same idempotency key', () => {
    const mutation = {
      idempotencyKey: 'session:123',
      operation: 'speaking-session.create',
      payloadHash: 'hash-a',
      status: 'pending' as const,
      attempts: 0,
    }
    const once = enqueueMutation([], mutation)
    expect(enqueueMutation(once, mutation)).toEqual(once)
  })

  it('rejects a reused key with a different payload', () => {
    const mutation = {
      idempotencyKey: 'session:123',
      operation: 'speaking-session.create',
      payloadHash: 'hash-a',
      status: 'pending' as const,
      attempts: 0,
    }
    expect(() => enqueueMutation([mutation], { ...mutation, payloadHash: 'hash-b' })).toThrow(
      'Idempotency key was reused with a different payload',
    )
  })

  it('only marks a mutation synced after processing', () => {
    const mutation = {
      idempotencyKey: 'session:123',
      operation: 'speaking-session.create',
      payloadHash: 'hash-a',
      status: 'pending' as const,
      attempts: 0,
    }
    expect(() => updateMutationStatus([mutation], 'session:123', 'synced')).toThrow(
      'Invalid sync status transition',
    )
    const processing = updateMutationStatus([mutation], 'session:123', 'processing')
    expect(updateMutationStatus(processing, 'session:123', 'synced')[0].status).toBe('synced')
  })
})
