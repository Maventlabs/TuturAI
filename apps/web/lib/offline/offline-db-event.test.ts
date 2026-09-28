import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifyOfflineMutationSynced, OFFLINE_MUTATION_SYNCED_EVENT } from './offline-db'

describe('offline sync notification', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('emits only the operation and idempotency key after server-confirmed sync', () => {
    const target = new EventTarget()
    let detail: unknown
    target.addEventListener(OFFLINE_MUTATION_SYNCED_EVENT, (event) => {
      detail = (event as CustomEvent).detail
    })
    vi.stubGlobal('window', target)

    notifyOfflineMutationSynced({ operation: 'assessment-audio', idempotencyKey: 'session-123' })

    expect(detail).toEqual({ operation: 'assessment-audio', idempotencyKey: 'session-123' })
  })
})
