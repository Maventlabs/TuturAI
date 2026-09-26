import { chromium } from 'playwright'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const databaseName = 'tuturai-offline'
const conflictSessionId = 'legacy-conflict-session'
const pendingSessionId = 'legacy-pending-session'
const quotaLimit = 25 * 1024 * 1024

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(new URL(baseURL).origin)) {
  throw new Error('Run this script against a local TuturAI instance; it seeds only a local IndexedDB test fixture.')
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const assessmentResponses = []
page.on('response', (response) => {
  if (new URL(response.url()).pathname === '/api/student/assessment' && response.request().method() === 'POST') {
    assessmentResponses.push(response.status())
  }
})

async function readOfflineState() {
  return page.evaluate(async (name) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not inspect offline database'))
    })
    const readAll = (storeName) => new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error(`Could not read ${storeName}`))
    })
    const mutations = await readAll('pendingMutations')
    const audioQueue = await readAll('audioQueue')
    const result = {
      version: database.version,
      mutations: mutations.map((mutation) => ({
        id: mutation.id,
        status: mutation.status,
        payloadCleared: mutation.payload === null,
        audioSize: mutation.payload?.audio instanceof Blob ? mutation.payload.audio.size : 0,
        fileSize: mutation.payload?.file instanceof Blob ? mutation.payload.file.size : 0,
      })),
      audioQueue: audioQueue.map((record) => ({ id: record.id, size: record.value instanceof Blob ? record.value.size : 0 })),
    }
    database.close()
    return result
  }, databaseName)
}

try {
  await page.goto(`${baseURL}/offline.html`)
  await page.evaluate(async (name) => {
    const pendingSessionId = 'legacy-pending-session'
    const conflictSessionId = 'legacy-conflict-session'
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const storeName of ['drafts', 'cache', 'audioQueue', 'pendingMutations']) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' })
            if (storeName === 'pendingMutations') store.createIndex('status', 'status', { unique: false })
          }
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not create v1 offline database'))
    })
    const now = Date.now()
    const syncedAudio = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
    const pendingAudio = new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/webm' })
    const conflictAudio = new Blob([new Uint8Array([10, 11, 12])], { type: 'audio/webm' })
    const syncedFile = new File([new Uint8Array([7, 8, 9])], 'answer.txt', { type: 'text/plain' })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['audioQueue', 'pendingMutations'], 'readwrite')
      const audioQueue = transaction.objectStore('audioQueue')
      const pendingMutations = transaction.objectStore('pendingMutations')
      audioQueue.put({ id: 'legacy-synced-session', value: syncedAudio, updatedAt: now })
      audioQueue.put({ id: pendingSessionId, value: pendingAudio, updatedAt: now })
      audioQueue.put({ id: conflictSessionId, value: conflictAudio, updatedAt: now })
      pendingMutations.put({ id: 'legacy-synced-audio', idempotencyKey: 'legacy-synced-session', operation: 'assessment-audio', payload: { sessionId: 'legacy-synced-session', audio: syncedAudio }, createdAt: now, attempts: 1, nextAttemptAt: now, status: 'synced' })
      pendingMutations.put({ id: 'legacy-synced-file', idempotencyKey: 'legacy-file-key', operation: 'submit-assignment', payload: { assignmentId: 'legacy-assignment', file: syncedFile }, createdAt: now, attempts: 1, nextAttemptAt: now, status: 'synced' })
      pendingMutations.put({ id: 'legacy-pending-audio', idempotencyKey: pendingSessionId, operation: 'assessment-audio', payload: { sessionId: pendingSessionId, audio: pendingAudio }, createdAt: now, attempts: 0, nextAttemptAt: now + 60_000, status: 'pending' })
      pendingMutations.put({ id: 'legacy-conflict-audio', idempotencyKey: 'legacy-conflict-key', operation: 'assessment-audio', payload: { sessionId: 'invalid/session', mode: 'conversation', expectedText: '', audio: conflictAudio }, createdAt: now, attempts: 0, nextAttemptAt: now - 1, status: 'pending' })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not seed v1 offline records'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not seed v1 offline records'))
    })
    database.close()
  }, databaseName)

  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').waitFor()
  await page.evaluate(async () => navigator.serviceWorker.ready)

  let state
  for (let attempt = 0; attempt < 20; attempt += 1) {
    state = await readOfflineState()
    if (state.version >= 2 && state.mutations.some((mutation) => mutation.id === 'legacy-conflict-audio' && mutation.status === 'conflict')) break
    await page.waitForTimeout(250)
  }
  if (state?.version !== 2) throw new Error(`Application did not migrate local IndexedDB to v2: ${JSON.stringify(state)}`)

  const syncedAudio = state.mutations.find((mutation) => mutation.id === 'legacy-synced-audio')
  const syncedFile = state.mutations.find((mutation) => mutation.id === 'legacy-synced-file')
  const pendingAudio = state.mutations.find((mutation) => mutation.id === 'legacy-pending-audio')
  if (!syncedAudio?.payloadCleared || !syncedFile?.payloadCleared) {
    throw new Error(`Synced legacy payloads were not cleared: ${JSON.stringify(state)}`)
  }
  if (!pendingAudio || pendingAudio.status !== 'pending' || pendingAudio.audioSize !== 3) {
    throw new Error(`Migration altered an unconfirmed pending payload: ${JSON.stringify(state)}`)
  }
  const conflictAudio = state.mutations.find((mutation) => mutation.id === 'legacy-conflict-audio')
  if (!conflictAudio || conflictAudio.status !== 'conflict' || conflictAudio.audioSize !== 3) {
    throw new Error(`Permanent API failure did not preserve the conflicted audio payload: ${JSON.stringify(state)}`)
  }
  const audioQueueIds = state.audioQueue.map((record) => record.id)
  if (!assessmentResponses.includes(401)) {
    throw new Error(`Expected queued replay to receive an unauthenticated 401, received ${JSON.stringify(assessmentResponses)}`)
  }
  if (audioQueueIds.includes('legacy-synced-session') || !audioQueueIds.includes(pendingSessionId) || !audioQueueIds.includes(conflictSessionId)) {
    throw new Error(`Audio cleanup did not distinguish confirmed and pending sessions: ${JSON.stringify(state)}`)
  }

  await page.evaluate(async ({ name, conflictId, oldId, newId }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open offline database for quota fixture'))
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('audioQueue', 'readwrite')
      const store = transaction.objectStore('audioQueue')
      const quotaBlobSize = 13 * 1024 * 1024
      store.put({ id: oldId, value: new Blob([new Uint8Array(quotaBlobSize)], { type: 'audio/webm' }), updatedAt: 1 })
      store.put({ id: newId, value: new Blob([new Uint8Array(quotaBlobSize)], { type: 'audio/webm' }), updatedAt: 2 })
      store.put({ id: conflictId, value: new Blob([new Uint8Array([10, 11, 12])], { type: 'audio/webm' }), updatedAt: Date.now() })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not seed quota records'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not seed quota records'))
    })
    database.close()
  }, { name: databaseName, conflictId: conflictSessionId, oldId: 'quota-oldest', newId: 'quota-newest' })

  await page.reload()
  let quotaState
  for (let attempt = 0; attempt < 20; attempt += 1) {
    quotaState = await readOfflineState()
    const ids = quotaState.audioQueue.map((record) => record.id)
    if (!ids.includes('quota-oldest') && ids.includes('quota-newest')) break
    await page.waitForTimeout(250)
  }
  const remainingAudioBytes = quotaState.audioQueue.reduce((total, record) => total + record.size, 0)
  const remainingAudioIds = quotaState.audioQueue.map((record) => record.id)
  if (remainingAudioIds.includes('quota-oldest') || !remainingAudioIds.includes('quota-newest') || remainingAudioBytes > quotaLimit) {
    throw new Error(`Audio quota cleanup failed: ${JSON.stringify({ remainingAudioBytes, remainingAudioIds })}`)
  }
  if (!remainingAudioIds.includes(conflictSessionId)) {
    throw new Error('Quota cleanup deleted audio for an unresolved conflicted mutation')
  }

  console.log(JSON.stringify({ ok: true, offlineDatabaseVersion: state.version, syncedPayloadsPurged: true, pendingAudioRetained: true, conflictStatus: conflictAudio.status, conflictResponseStatus: 401, quotaCleanup: true, remainingAudioBytes }))
} finally {
  await browser.close()
}
