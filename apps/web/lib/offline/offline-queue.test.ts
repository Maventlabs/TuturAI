import { describe, expect, it } from 'vitest'
import {
  createPendingMutation,
  getRetryDelayMs,
  isRetryDue,
  markMutationSynced,
  markMutationConflict,
  pendingMutationCount,
  retryMutation,
} from './offline-queue'

describe('offline queue primitives', () => {
  it('preserves an idempotency key when creating a queued mutation', () => {
    const mutation = createPendingMutation(
      { operation: 'submit-assignment', payload: { assignmentId: 'a1' }, idempotencyKey: 'client-1' },
      1_000,
      'mutation-1',
    )

    expect(mutation).toMatchObject({
      id: 'mutation-1',
      idempotencyKey: 'client-1',
      createdAt: 1_000,
      attempts: 0,
      nextAttemptAt: 1_000,
      status: 'pending',
    })
  })

  it('uses exponential retry delays with a bounded maximum', () => {
    expect(getRetryDelayMs(0)).toBe(1_000)
    expect(getRetryDelayMs(2)).toBe(4_000)
    expect(getRetryDelayMs(10)).toBe(60_000)
  })

  it('counts pending mutations without treating them as synced', () => {
    const mutations = [
      createPendingMutation({ operation: 'one', payload: null }, 1, 'one'),
      { ...createPendingMutation({ operation: 'two', payload: null }, 2, 'two'), status: 'failed' as const },
      { ...createPendingMutation({ operation: 'three', payload: null }, 3, 'three'), status: 'synced' as const },
    ]

    expect(pendingMutationCount(mutations)).toBe(2)
    expect(isRetryDue(mutations[0], 1)).toBe(true)
    expect(isRetryDue({ ...mutations[0], nextAttemptAt: 10 }, 1)).toBe(false)
  })

  it('marks a mutation failed with the next bounded retry time', () => {
    const mutation = createPendingMutation({ operation: 'one', payload: null }, 1, 'one')
    expect(retryMutation(mutation, 2)).toMatchObject({ attempts: 1, nextAttemptAt: 1002, status: 'failed' })
  })

  it('marks a mutation synced only after the executor confirms it', () => {
    const mutation = createPendingMutation({ operation: 'one', payload: null }, 1, 'one')
    expect(markMutationSynced(mutation).status).toBe('synced')
  })

  it('marks permanent failures as conflicts without retrying them', () => {
    const mutation = createPendingMutation({ operation: 'submit', payload: null }, 1, 'one')
    expect(markMutationConflict(mutation).status).toBe('conflict')
  })
})
