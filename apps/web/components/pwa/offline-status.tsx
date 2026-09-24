'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  countPendingMutations,
  PENDING_MUTATIONS_CHANGED_EVENT,
} from '@/lib/offline/offline-db'

export function OfflineStatus() {
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

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <Badge variant={isOnline ? 'outline' : 'destructive'} className="gap-1.5">
        {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {isOnline ? 'Online' : 'Offline'}
      </Badge>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {pendingCount === null ? 'Penyimpanan lokal tidak tersedia' : `${pendingCount} menunggu dikirim`}
      </span>
    </div>
  )
}
