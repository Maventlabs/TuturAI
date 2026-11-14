'use client'

import { cn } from '@/lib/utils'
import { EmptyNote } from '@/components/guru/overview/panel'
import { deviceName, type DeviceRow } from './types'

const WEAK_SIGNAL = 40

export function SignalRanking({ devices }: { devices: DeviceRow[] }) {
  const measured = devices
    .filter((device) => typeof device.signal === 'number')
    .sort((left, right) => (left.signal as number) - (right.signal as number))

  if (measured.length === 0) {
    return (
      <EmptyNote
        title="Belum ada data sinyal"
        description="Kekuatan sinyal dikirim bersama heartbeat. Perangkat yang belum terhubung belum punya angka."
      />
    )
  }

  const weak = measured.filter((device) => (device.signal as number) < WEAK_SIGNAL).length

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="space-y-2.5">
        {measured.slice(0, 6).map((device) => {
          const signal = device.signal as number
          return (
            <li key={device.id} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-[12px] text-foreground" title={deviceName(device)}>
                {deviceName(device)}
              </span>
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn('block h-full rounded-full transition-[width] duration-500', signal < WEAK_SIGNAL ? 'bg-warning' : 'bg-primary')}
                  style={{ width: `${Math.max(signal, 3)}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{signal}%</span>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
        {weak === 0 ? `Semua unit di atas ${WEAK_SIGNAL}%` : `${weak} unit di bawah ${WEAK_SIGNAL}%`}
      </p>
    </div>
  )
}
