'use client'

import { cn } from '@/lib/utils'
import { formatClock, type DeviceActivityBucket } from './types'

interface FleetActivityProps {
  series: DeviceActivityBucket[]
  deviceCount: number
}

/**
 * The one dark surface on this page: a 24-hour heartbeat trace for the whole
 * fleet. Bars are hourly counts, so a flat line means devices stopped calling —
 * which is exactly the failure a teacher needs to see at a glance.
 */
export function FleetActivity({ series, deviceCount }: FleetActivityProps) {
  const total = series.reduce((sum, bucket) => sum + bucket.count, 0)
  const peak = series.reduce((max, bucket) => Math.max(max, bucket.count), 0)
  const peakIndex = series.findIndex((bucket) => bucket.count === peak && peak > 0)
  const lastIndex = series.length - 1
  const axisIndexes = [0, 6, 12, 18, lastIndex]

  return (
    <div className="border-t border-rule bg-ink-deep px-4 pt-4 pb-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Aktivitas heartbeat · 24 jam</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted/70">
          {deviceCount === 0
            ? 'Belum ada perangkat'
            : peak > 0
              ? `Puncak ${peak} heartbeat pada ${formatClock(series[peakIndex].hour)}`
              : 'Belum ada heartbeat masuk'}
        </p>
      </div>

      <div className="mt-4 flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex h-24 items-end gap-[3px] sm:h-28" role="img" aria-label={`${total} heartbeat dalam 24 jam terakhir`}>
            {series.map((bucket, index) => {
              const isCurrent = index === lastIndex
              const isPeak = index === peakIndex
              const height = peak === 0 ? 0 : Math.max(4, Math.round((bucket.count / peak) * 100))
              return (
                <div key={bucket.hour} className="flex h-full flex-1 items-end">
                  <div
                    className={cn(
                      'w-full rounded-[1px] transition-[height] duration-500',
                      bucket.count === 0
                        ? 'bg-ink-foreground/12'
                        : isCurrent
                          ? 'bg-primary'
                          : isPeak
                            ? 'bg-ink-foreground/45'
                            : 'bg-ink-foreground/25',
                    )}
                    style={{ height: bucket.count === 0 ? 2 : `${height}%` }}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-ink-foreground/10 pt-1.5">
            {axisIndexes.map((index) => (
              <span key={index} className="font-mono text-[9px] tabular-nums text-ink-muted/60">
                {formatClock(series[index].hour)}
              </span>
            ))}
          </div>
        </div>

        <dl className="hidden shrink-0 border-l border-ink-foreground/10 pl-4 sm:block">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted/60">Total</dt>
          <dd className="font-mono text-[22px] leading-none tabular-nums text-ink-foreground">{total}</dd>
          <dt className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted/60">Jam ini</dt>
          <dd className="font-mono text-[13px] tabular-nums text-ink-foreground">{series[lastIndex].count}</dd>
        </dl>
      </div>
    </div>
  )
}
