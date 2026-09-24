'use client'

import { useEffect } from 'react'
import { cleanupAudioQueue, replayPendingMutations } from '@/lib/offline/offline-db'
import { OfflineMutationError } from '@/lib/offline/offline-queue'

async function replayMutation(mutation: { operation: string; payload: unknown; idempotencyKey: string }) {
  const payload = mutation.payload as Record<string, unknown>
  if (mutation.operation === 'conversation-text') {
    const response = await fetch('/api/student/conversation-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': mutation.idempotencyKey },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new OfflineMutationError('Conversation replay failed', response.status >= 500)
    return
  }
  if (mutation.operation === 'submit-assignment') {
    const response = await fetch(`/api/assignments/${String(payload.assignmentId)}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': mutation.idempotencyKey },
      body: new FormData(),
    })
    if (!response.ok) throw new OfflineMutationError('Assignment replay failed', response.status >= 500)
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
    const replay = () => { void replayPendingMutations(replayMutation) }
    window.addEventListener('online', replay)
    replay()
    void cleanupAudioQueue(25 * 1024 * 1024)
    return () => window.removeEventListener('online', replay)
  }, [])

  return null
}
