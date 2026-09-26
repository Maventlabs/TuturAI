import {
  createPendingMutation,
  isRetryDue,
  markMutationSynced,
  markMutationConflict,
  OfflineMutationError,
  pendingMutationCount,
  retryMutation,
  type PendingMutation,
  type PendingMutationInput,
} from './offline-queue'

export const OFFLINE_DB_NAME = 'tuturai-offline'
export const OFFLINE_DB_VERSION = 2

export const OFFLINE_STORES = {
  drafts: 'drafts',
  cache: 'cache',
  audioQueue: 'audioQueue',
  pendingMutations: 'pendingMutations',
} as const

export type OfflineStoreName = (typeof OFFLINE_STORES)[keyof typeof OFFLINE_STORES]

export interface OfflineRecord<T = unknown> {
  id: string
  value: T
  updatedAt: number
}

export const PENDING_MUTATIONS_CHANGED_EVENT = 'tuturai:pending-mutations-changed'

export function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result

      for (const storeName of Object.values(OFFLINE_STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' })
          if (storeName === OFFLINE_STORES.pendingMutations) {
            store.createIndex('status', 'status', { unique: false })
          }
        }
      }

      if (event.oldVersion < 2) {
        const transaction = request.transaction
        if (!transaction) return
        const mutations = transaction.objectStore(OFFLINE_STORES.pendingMutations)
        const audio = transaction.objectStore(OFFLINE_STORES.audioQueue)
        const cursorRequest = mutations.openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (!cursor) return

          const mutation = cursor.value as PendingMutation
          if (mutation.status === 'synced') {
            const payload = mutation.payload as { sessionId?: unknown } | null
            if (typeof payload?.sessionId === 'string') audio.delete(payload.sessionId)
            cursor.update({ ...mutation, payload: null })
          }
          cursor.continue()
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

export async function putOfflineRecord<T>(
  storeName: OfflineStoreName,
  id: string,
  value: T,
  now = Date.now(),
): Promise<void> {
  const db = await openOfflineDb()

  await runTransaction(db, storeName, 'readwrite', (store) => {
    store.put({ id, value, updatedAt: now } satisfies OfflineRecord<T>)
  })
}

export async function getOfflineRecord<T>(
  storeName: OfflineStoreName,
  id: string,
): Promise<OfflineRecord<T> | undefined> {
  const db = await openOfflineDb()

  return runRequest<OfflineRecord<T> | undefined>(db, storeName, 'readonly', (store) =>
    store.get(id),
  )
}

export async function deleteOfflineRecord(
  storeName: OfflineStoreName,
  id: string,
): Promise<void> {
  const db = await openOfflineDb()

  await runTransaction(db, storeName, 'readwrite', (store) => {
    store.delete(id)
  })
}

export async function enqueuePendingMutation(input: PendingMutationInput): Promise<PendingMutation> {
  const mutation = createPendingMutation(input)
  const db = await openOfflineDb()

  await runTransaction(db, OFFLINE_STORES.pendingMutations, 'readwrite', (store) => {
    store.put(mutation)
  })
  notifyPendingMutationsChanged()
  return mutation
}

export async function countPendingMutations(): Promise<number> {
  const db = await openOfflineDb()
  const mutations = await runRequest<PendingMutation[]>(
    db,
    OFFLINE_STORES.pendingMutations,
    'readonly',
    (store) => store.getAll(),
  )

  return pendingMutationCount(mutations)
}

export async function listPendingMutations(): Promise<PendingMutation[]> {
  const db = await openOfflineDb()
  return runRequest<PendingMutation[]>(db, OFFLINE_STORES.pendingMutations, 'readonly', (store) => store.getAll())
}

export async function replayPendingMutations(
  executor: (mutation: PendingMutation) => Promise<void>,
  now = Date.now(),
): Promise<{ synced: number; failed: number }> {
  const mutations = (await listPendingMutations()).filter((mutation) => isRetryDue(mutation, now))
  let synced = 0
  let failed = 0

  for (const mutation of mutations) {
    try {
      await executor(mutation)
      await updatePendingMutation(markMutationSynced(mutation))
      synced += 1
    } catch (cause) {
      const isConflict = cause instanceof OfflineMutationError && !cause.retryable
      await updatePendingMutation(isConflict ? markMutationConflict(mutation) : retryMutation(mutation, now))
      failed += 1
    }
  }

  if (mutations.length > 0) notifyPendingMutationsChanged()
  return { synced, failed }
}

export async function updatePendingMutation(mutation: PendingMutation): Promise<void> {
  const db = await openOfflineDb()
  await runTransaction(db, OFFLINE_STORES.pendingMutations, 'readwrite', (store) => store.put(mutation))
}

export async function cleanupAudioQueue(maxBytes: number): Promise<{ removed: number; bytesRemoved: number }> {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) throw new Error('Invalid audio cleanup quota')
  const db = await openOfflineDb()
  const records = await runRequest<OfflineRecord<unknown>[]>(db, OFFLINE_STORES.audioQueue, 'readonly', (store) => store.getAll())
  const sizeOf = (record: OfflineRecord<unknown>) => {
    if (record.value instanceof Blob) return record.value.size
    if (record.value && typeof record.value === 'object' && 'size' in record.value && typeof record.value.size === 'number') {
      return record.value.size
    }
    return 0
  }
  let total = records.reduce((sum, record) => sum + sizeOf(record), 0)
  let removed = 0
  let bytesRemoved = 0
  for (const record of records.sort((left, right) => left.updatedAt - right.updatedAt)) {
    if (total <= maxBytes) break
    const size = sizeOf(record)
    await deleteOfflineRecord(OFFLINE_STORES.audioQueue, record.id)
    total -= size
    removed += 1
    bytesRemoved += size
  }
  return { removed, bytesRemoved }
}

export function notifyPendingMutationsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PENDING_MUTATIONS_CHANGED_EVENT))
  }
}

function runTransaction(
  db: IDBDatabase,
  storeName: OfflineStoreName,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    operation(transaction.objectStore(storeName))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function runRequest<T>(
  db: IDBDatabase,
  storeName: OfflineStoreName,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = operation(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}
