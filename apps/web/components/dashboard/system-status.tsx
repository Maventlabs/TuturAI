'use client'

import { useEffect, useState } from 'react'
import { Check, CloudUpload, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  countPendingMutations,
  PENDING_MUTATIONS_CHANGED_EVENT,
} from '@/lib/offline/offline-db'
import { HardwareStatus } from '@/components/dashboard/hardware-status'

export function SystemStatus({ showDevice }: { showDevice: boolean }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine)
    const updatePendingCount = () => {
      void countPendingMutations()
        .then(setPendingCount)
        .catch(() => setPendingCount(null))
    }

    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    window.addEventListener(PENDING_MUTATIONS_CHANGED_EVENT, updatePendingCount)
    updateOnlineState()
    updatePendingCount()

    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
      window.removeEventListener(PENDING_MUTATIONS_CHANGED_EVENT, updatePendingCount)
    }
  }, [])

  const queued = pendingCount ?? 0
  const hasQueue = queued > 0
  const queueUnavailable = pendingCount === null

  return (
    <div
      className="flex h-9 items-center rounded-full border border-border bg-card p-1"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5 pl-2 pr-2.5">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {isOnline && <span className="absolute inset-0 animate-ping rounded-full bg-success/70" />}
          <span
            className={cn(
              'relative h-1.5 w-1.5 rounded-full',
              isOnline ? 'bg-success' : 'bg-warning',
            )}
          />
        </span>
        <span className={cn('text-xs font-medium', isOnline ? 'text-foreground' : 'text-warning')}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </span>

      <span className="h-3.5 w-px bg-border" aria-hidden="true" />

      <span className="flex items-center gap-1.5 px-2.5">
        {queueUnavailable ? (
          <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        ) : hasQueue ? (
          <CloudUpload className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        )}
        <span
          className={cn(
            'font-mono text-[11px] font-semibold tabular-nums',
            hasQueue ? 'text-primary-deep' : 'text-foreground',
          )}
        >
          {queueUnavailable ? '—' : queued}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">menunggu</span>
      </span>

      {showDevice && (
        <>
          <span className="h-3.5 w-px bg-border" aria-hidden="true" />
          <HardwareStatus />
        </>
      )}
    </div>
  )
}
