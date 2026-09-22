export type MutationStatus = 'pending' | 'processing' | 'synced' | 'failed'

export interface SyncMutation {
  idempotencyKey: string
  operation: string
  payloadHash: string
  status: MutationStatus
  attempts: number
}

export function enqueueMutation(queue: SyncMutation[], mutation: SyncMutation): SyncMutation[] {
  const existing = queue.find((item) => item.idempotencyKey === mutation.idempotencyKey)
  if (!existing) return [...queue, mutation]
  if (existing.payloadHash !== mutation.payloadHash) {
    throw new Error('Idempotency key was reused with a different payload')
  }
  return queue
}

export function updateMutationStatus(
  queue: SyncMutation[],
  idempotencyKey: string,
  status: MutationStatus,
): SyncMutation[] {
  return queue.map((mutation) => {
    if (mutation.idempotencyKey !== idempotencyKey) return mutation
    const valid =
      (mutation.status === 'pending' && status === 'processing') ||
      (mutation.status === 'failed' && status === 'processing') ||
      (mutation.status === 'processing' && (status === 'synced' || status === 'failed'))
    if (!valid) throw new Error('Invalid sync status transition')
    return { ...mutation, status, attempts: status === 'processing' ? mutation.attempts + 1 : mutation.attempts }
  })
}
