export type PendingMutationStatus = 'pending' | 'failed' | 'conflict' | 'synced'

export interface PendingMutation {
  id: string
  idempotencyKey: string
  operation: string
  payload: unknown
  createdAt: number
  attempts: number
  nextAttemptAt: number
  status: PendingMutationStatus
}

export interface PendingMutationRetry extends PendingMutation {
  status: 'pending' | 'failed'
}

export interface PendingMutationInput {
  operation: string
  payload: unknown
  idempotencyKey?: string
}

export class OfflineMutationError extends Error {
  readonly retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'OfflineMutationError'
    this.retryable = retryable
  }
}

const DEFAULT_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 60_000

export function createPendingMutation(
  input: PendingMutationInput,
  now = Date.now(),
  id = createId(),
): PendingMutation {
  return {
    id,
    idempotencyKey: input.idempotencyKey ?? `${input.operation}:${id}`,
    operation: input.operation,
    payload: input.payload,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    status: 'pending',
  }
}

export function getRetryDelayMs(
  attempt: number,
  baseDelayMs = DEFAULT_RETRY_DELAY_MS,
  maxDelayMs = MAX_RETRY_DELAY_MS,
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt))
  return Math.min(maxDelayMs, baseDelayMs * 2 ** safeAttempt)
}

export function isRetryDue(mutation: PendingMutation, now = Date.now()): boolean {
  return (mutation.status === 'pending' || mutation.status === 'failed') && mutation.nextAttemptAt <= now
}

export function pendingMutationCount(mutations: Pick<PendingMutation, 'status'>[]): number {
  return mutations.filter((mutation) => mutation.status === 'pending' || mutation.status === 'failed').length
}

export function retryMutation(mutation: PendingMutation, now = Date.now()): PendingMutation {
  const attempts = mutation.attempts + 1
  return {
    ...mutation,
    attempts,
    nextAttemptAt: now + getRetryDelayMs(mutation.attempts),
    status: 'failed',
  }
}

export function markMutationSynced(mutation: PendingMutation): PendingMutation {
  return { ...mutation, payload: null, status: 'synced' }
}

export function markMutationConflict(mutation: PendingMutation): PendingMutation {
  return { ...mutation, status: 'conflict' }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
