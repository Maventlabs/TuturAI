'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  countPendingMutations,
  PENDING_MUTATIONS_CHANGED_EVENT,
  SYNC_REQUESTED_EVENT,
} from '@/lib/offline/offline-db'
import { HardwareStatus } from '@/components/dashboard/hardware-status'
import { RailIndicator, RailReadout, RailValue } from '@/components/dashboard/rail-readout'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function SystemStatus({ showDevice }: { showDevice: boolean }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine)
    const updatePendingCount = () => {
      void countPendingMutations()
        .then((count) => {
          setPendingCount(count)
          setSyncing(false)
        })
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

  function requestSync() {
    if (!isOnline || !hasQueue) return
    setSyncing(true)
    window.dispatchEvent(new Event(SYNC_REQUESTED_EVENT))
  }

  return (
    <div className="flex items-stretch">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Status sinkronisasi: ${isOnline ? 'tersambung' : 'luring'}, ${
                queueUnavailable ? 'antrean tidak terbaca' : `${queued} perubahan menunggu dikirim`
              }`}
              className="flex items-stretch outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
            />
          }
        >
          {/* Below sm the rail keeps a single LED cell so the search field keeps
              its width; the full readout lives in the panel. */}
          <span className="flex items-center gap-1.5 px-2.5 sm:hidden">
            <RailIndicator tone={isOnline ? 'ok' : 'warn'} />
            <span
              className={cn(
                'font-mono text-[11px] font-medium tabular-nums',
                isOnline ? 'text-foreground' : 'text-warning',
              )}
            >
              {isOnline ? (queueUnavailable ? '—' : queued) : 'Luring'}
            </span>
          </span>

          <RailReadout label="Jaringan" className="hidden sm:flex">
            <RailIndicator tone={isOnline ? 'ok' : 'warn'} />
            <RailValue tone={isOnline ? 'default' : 'attention'}>
              {isOnline ? 'Tersambung' : 'Luring'}
            </RailValue>
          </RailReadout>

          <span className="my-3 hidden w-px bg-rule sm:block" aria-hidden="true" />

          <RailReadout label="Antrean" className="hidden sm:flex">
            <RailValue tone={hasQueue ? 'attention' : 'default'}>
              {queueUnavailable ? '—' : queued}
            </RailValue>
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">tertunda</span>
          </RailReadout>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 p-0">
          <div className="flex items-center justify-between border-b border-rule px-3 py-2">
            <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Sinkronisasi
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
              {isOnline ? 'Daring' : 'Luring'}
            </span>
          </div>

          <dl className="divide-y divide-rule">
            <StatusRow
              label="Jaringan"
              value={isOnline ? 'Tersambung' : 'Luring'}
              tone={isOnline ? 'ok' : 'warn'}
            />
            <StatusRow
              label="Antrean"
              value={queueUnavailable ? 'Tidak terbaca' : `${queued} perubahan`}
              tone={hasQueue ? 'warn' : 'ok'}
            />
          </dl>

          <p className="border-t border-rule px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Perubahan disimpan di perangkat dan dikirim otomatis saat koneksi kembali.
          </p>

          {hasQueue && (
            <div className="border-t border-rule p-2">
              <button
                type="button"
                onClick={requestSync}
                disabled={!isOnline || syncing}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-sm bg-foreground font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} aria-hidden="true" />
                {syncing ? 'Mengirim' : 'Kirim sekarang'}
              </button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showDevice && (
        <>
          <span className="my-3 w-px bg-rule" aria-hidden="true" />
          <div className="hidden items-stretch lg:flex">
            <HardwareStatus />
          </div>
        </>
      )}
    </div>
  )
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ok' | 'warn'
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5">
        <RailIndicator tone={tone} />
        <span
          className={cn(
            'font-mono text-[11px] font-medium tabular-nums',
            tone === 'warn' ? 'text-warning' : 'text-foreground',
          )}
        >
          {value}
        </span>
      </dd>
    </div>
  )
}
