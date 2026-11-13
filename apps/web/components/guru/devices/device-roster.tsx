'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyNote } from '@/components/guru/overview/panel'
import { STATUS_LABEL, deviceName, formatRelative, type DeviceRow } from './types'

const DOT_CLASS: Record<DeviceRow['status'], string> = {
  online: 'bg-success',
  pairing: 'bg-warning',
  offline: 'bg-muted-foreground/40',
}

const LABEL_CLASS: Record<DeviceRow['status'], string> = {
  online: 'text-success',
  pairing: 'text-warning',
  offline: 'text-muted-foreground/70',
}

function Meter({ value, tone }: { value: number | null; tone: 'battery' | 'signal' }) {
  if (value === null) {
    return <span className="font-mono text-[11px] tabular-nums text-muted-foreground/50">—</span>
  }
  const critical = tone === 'battery' && value < 20
  const low = tone === 'battery' ? value < 50 : value < 40
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full', critical ? 'bg-destructive' : low ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${Math.max(value, 2)}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{value}%</span>
    </span>
  )
}

interface DeviceRosterProps {
  devices: DeviceRow[]
  now: number
  busyId: string | null
  onRevoke: (deviceId: string) => void
  onReissue: (deviceId: string) => void
  onRegister: () => void
}

export function DeviceRoster({ devices, now, busyId, onRevoke, onReissue, onRegister }: DeviceRosterProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copyId(deviceId: string) {
    try {
      await navigator.clipboard.writeText(deviceId)
      setCopiedId(deviceId)
      window.setTimeout(() => setCopiedId((current) => (current === deviceId ? null : current)), 1600)
    } catch {
      setCopiedId(null)
    }
  }

  if (devices.length === 0) {
    return (
      <div className="px-4 py-6 sm:px-5">
        <EmptyNote
          title="Belum ada perangkat terdaftar"
          description="Buat kode pairing, masukkan kode itu di perangkat ESP32, lalu unit akan muncul di sini dengan ID dan telemetrinya sendiri."
          action={
            <button
              type="button"
              onClick={onRegister}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
            >
              Buat kode pairing
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <div className="hidden items-center gap-x-4 border-b border-rule px-5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60 sm:flex">
        <span className="min-w-0 flex-1">Unit</span>
        <span className="w-28 shrink-0">Baterai</span>
        <span className="w-24 shrink-0">Sinyal</span>
        <span className="hidden w-20 shrink-0 lg:block">Firmware</span>
        <span className="w-24 shrink-0">Terakhir</span>
        <span className="w-24 shrink-0 text-right">Aksi</span>
      </div>

      <ul className="divide-y divide-rule">
        {devices.map((device) => {
          const isConfirming = confirmId === device.id
          const isBusy = busyId === device.id
          return (
            <li key={device.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 flex-1 basis-44 items-center gap-2.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASS[device.status])} aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{deviceName(device)}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {device.id}
                    <span className={cn('ml-2 uppercase tracking-[0.1em]', LABEL_CLASS[device.status])}>
                      {STATUS_LABEL[device.status]}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex w-28 shrink-0 items-center">
                <Meter value={device.battery} tone="battery" />
              </div>

              <div className="flex w-24 shrink-0 items-center">
                <Meter value={device.signal} tone="signal" />
              </div>

              <span className="hidden w-20 shrink-0 truncate font-mono text-[10px] text-muted-foreground lg:block">
                {device.firmware ?? '—'}
              </span>

              <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">
                {formatRelative(device.lastSyncAt, now)}
              </span>

              <div className="flex w-24 shrink-0 items-center justify-end gap-1">
                {isConfirming ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(null)
                        onRevoke(device.id)
                      }}
                      disabled={isBusy}
                      className="font-mono text-[9px] uppercase tracking-[0.1em] text-destructive hover:underline disabled:opacity-50"
                    >
                      Yakin
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:underline"
                    >
                      Batal
                    </button>
                  </>
                ) : device.status === 'pairing' ? (
                  <button
                    type="button"
                    onClick={() => onReissue(device.id)}
                    disabled={isBusy}
                    className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary hover:underline disabled:opacity-50"
                  >
                    Buat kode
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyId(device.id)}
                      aria-label={`Salin ID ${device.id}`}
                      className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {copiedId === device.id ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(device.id)}
                      className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-destructive hover:underline"
                    >
                      Cabut
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
