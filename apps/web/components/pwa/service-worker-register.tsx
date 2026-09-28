'use client'

import { useEffect } from 'react'
import { cleanupAudioQueue, deleteOfflineRecord, replayPendingMutations } from '@/lib/offline/offline-db'
import { OfflineMutationError } from '@/lib/offline/offline-queue'

export async function ensureReplayResponse(response: Response, fallbackMessage: string) {
  if (response.ok) return
  const payload = await response.json().catch(() => null) as { error?: { message?: string; details?: { retryable?: boolean } } } | null
  const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500 || payload?.error?.details?.retryable === true
  throw new OfflineMutationError(payload?.error?.message ?? fallbackMessage, retryable)
}

async function replayMutation(mutation: { operation: string; payload: unknown; idempotencyKey: string }) {
  const payload = mutation.payload as Record<string, unknown>
  if (mutation.operation === 'conversation-text') {
    const response = await fetch('/api/student/conversation-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': mutation.idempotencyKey },
      body: JSON.stringify(payload),
    })
    await ensureReplayResponse(response, 'Conversation replay failed')
    return
  }
  if (mutation.operation === 'submit-assignment') {
    const body = new FormData()
    const file = payload.file
    if (file instanceof Blob && file.size > 0) {
      body.set('file', file, file instanceof File ? file.name : 'submission.bin')
    }
    const response = await fetch(`/api/assignments/${String(payload.assignmentId)}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': mutation.idempotencyKey },
      body,
    })
    await ensureReplayResponse(response, 'Assignment replay failed')
    return
  }
  if (mutation.operation === 'assessment-audio') {
    const audio = payload.audio
    if (!(audio instanceof Blob) || audio.size === 0) {
      throw new OfflineMutationError('Queued audio is no longer available', false)
    }
    const body = new FormData()
    body.set('sessionId', String(payload.sessionId))
    body.set('mode', String(payload.mode))
    body.set('expectedText', String(payload.expectedText ?? ''))
    body.set('audio', audio, audio instanceof File ? audio.name : 'conversation.webm')
    const response = await fetch('/api/student/assessment', {
      method: 'POST',
      headers: { 'Idempotency-Key': mutation.idempotencyKey },
      body,
    })
    await ensureReplayResponse(response, 'Audio assessment replay failed')
    await deleteOfflineRecord('audioQueue', String(payload.sessionId))
    return
  }
  throw new Error(`Unsupported offline mutation: ${mutation.operation}`)
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    const replay = () => {
      if (!navigator.onLine) return
      void replayPendingMutations(replayMutation)
    }
    window.addEventListener('online', replay)
    replay()
    void cleanupAudioQueue(25 * 1024 * 1024)
    return () => window.removeEventListener('online', replay)
  }, [])

  return null
}
