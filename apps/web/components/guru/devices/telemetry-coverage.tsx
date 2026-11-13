'use client'

import { cn } from '@/lib/utils'
import type { DeviceRow } from './types'

export function TelemetryCoverage({ devices }: { devices: DeviceRow[] }) {
  const total = devices.length
  const rows = [
    { dimension: 'Heartbeat', count: devices.filter((device) => device.lastSyncAt !== null).length, detail: 'Waktu kontak terakhir' },
    { dimension: 'Baterai', count: devices.filter((device) => device.battery !== null).length, detail: 'Persen daya tersisa' },
    { dimension: 'Sinyal', count: devices.filter((device) => device.signal !== null).length, detail: 'Kekuatan Wi-Fi' },
    { dimension: 'Firmware', count: devices.filter((device) => device.firmware !== null).length, detail: 'Versi yang berjalan' },
    { dimension: 'Hardware ID', count: devices.filter((device) => device.hardwareId !== null).length, detail: 'MAC atau chip ID' },
  ]
  const measured = rows.filter((row) => row.count > 0).length

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="divide-y divide-rule">
        {rows.map((row) => (
          <li key={row.dimension} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[13px] text-foreground">{row.dimension}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{row.detail}</p>
            </div>
            <span
              className={cn(
                'shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] tabular-nums',
                row.count > 0 ? 'text-primary' : 'text-muted-foreground/50',
              )}
            >
              {row.count}/{total}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
        {measured} dari {rows.length} field terisi
      </p>
    </div>
  )
}
