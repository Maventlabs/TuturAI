'use client'

import { cn } from '@/lib/utils'
import { EmptyNote } from '@/components/guru/overview/panel'
import type { DeviceRow } from './types'

const BUCKETS = [
  { label: '0–19', min: 0, max: 19, tone: 'critical' as const },
  { label: '20–39', min: 20, max: 39, tone: 'low' as const },
  { label: '40–59', min: 40, max: 59, tone: 'normal' as const },
  { label: '60–79', min: 60, max: 79, tone: 'normal' as const },
  { label: '80–100', min: 80, max: 100, tone: 'normal' as const },
]

const TONE_CLASS = {
  critical: 'bg-destructive',
  low: 'bg-warning',
  normal: 'bg-primary',
} as const

export function BatterySpread({ devices }: { devices: DeviceRow[] }) {
  const measured = devices.filter((device) => typeof device.battery === 'number')
  const counts = BUCKETS.map((bucket) => ({
    ...bucket,
    count: measured.filter((device) => (device.battery as number) >= bucket.min && (device.battery as number) <= bucket.max).length,
  }))
  const peak = counts.reduce((max, bucket) => Math.max(max, bucket.count), 0)

  if (measured.length === 0) {
    return (
      <EmptyNote
        title="Belum ada level baterai"
        description="Baterai terbaca dari heartbeat pertama. Perangkat yang belum dipasangkan tidak melaporkan telemetri."
      />
    )
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="space-y-2.5">
        {counts.map((bucket) => (
          <li key={bucket.label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{bucket.label}</span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn('block h-full rounded-full transition-[width] duration-500', TONE_CLASS[bucket.tone])}
                style={{ width: peak === 0 ? 0 : `${Math.max(bucket.count === 0 ? 0 : 8, Math.round((bucket.count / peak) * 100))}%` }}
              />
            </span>
            <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{bucket.count}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
        {measured.length} dari {devices.length} unit melaporkan baterai
      </p>
    </div>
  )
}
