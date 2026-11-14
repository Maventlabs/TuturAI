'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RailIndicator, RailReadout, RailValue } from '@/components/dashboard/rail-readout'
import { cn } from '@/lib/utils'

type Device = {
  status: 'online' | 'offline' | 'busy'
  battery: number | null
  signal: number | null
  lastSyncAt: string | null
}

async function fetchDevice(): Promise<{ ok: boolean; device: Device | null }> {
  const response = await fetch('/api/teacher/devices', { cache: 'no-store' })
  const payload = (await response.json()) as { data?: Device[] }
  return { ok: response.ok, device: Array.isArray(payload.data) ? (payload.data[0] ?? null) : null }
}

export function HardwareStatus() {
  const [syncing, setSyncing] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [device, setDevice] = useState<Device | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchDevice()
      .then((result) => {
        if (cancelled) return
        setUnavailable(!result.ok)
        setDevice(result.device)
      })
      .catch(() => {
        if (cancelled) return
        setUnavailable(true)
        setDevice(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    setSyncing(true)
    try {
      const result = await fetchDevice()
      setUnavailable(!result.ok)
      setDevice(result.device)
    } catch {
      setUnavailable(true)
      setDevice(null)
    } finally {
      setSyncing(false)
    }
  }

  const online = device?.status === 'online' || device?.status === 'busy'
  const battery = device?.battery
  const lastSync = device?.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString('id-ID') : 'Belum pernah'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Status perangkat kelas"
            className="flex items-stretch outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
          />
        }
      >
        <RailReadout label="Perangkat">
          <RailIndicator tone={unavailable ? 'idle' : online ? 'ok' : 'warn'} />
          <RailValue tone={!unavailable && !online ? 'attention' : 'default'}>
            {unavailable ? 'Belum ada' : online ? 'Terhubung' : 'Luring'}
          </RailValue>
        </RailReadout>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b border-rule px-3 py-2">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Perangkat kelas
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
            {device ? 'Terdaftar' : 'Kosong'}
          </span>
        </div>

        <dl className="divide-y divide-rule">
          <DeviceRow
            label="Status"
            value={unavailable ? 'Belum tersedia' : online ? 'Terhubung' : 'Luring'}
            tone={unavailable ? 'idle' : online ? 'ok' : 'warn'}
          />
          <DeviceRow
            label="Baterai"
            value={battery === null || battery === undefined ? 'Belum ada' : `${battery}%`}
          />
          <DeviceRow
            label="Sinyal"
            value={device?.signal === null || device?.signal === undefined ? 'Belum ada' : `${device.signal}%`}
          />
          <DeviceRow label="Sinkron terakhir" value={lastSync} />
        </dl>

        <div className="border-t border-rule p-2">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={syncing}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-sm border border-rule font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} aria-hidden="true" />
            {syncing ? 'Memuat' : 'Muat ulang'}
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DeviceRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn' | 'idle'
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5">
        {tone && <RailIndicator tone={tone} />}
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
