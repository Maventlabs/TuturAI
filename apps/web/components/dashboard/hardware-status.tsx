'use client'

import { useEffect, useState } from 'react'
import { Cpu, Battery, RefreshCw, Wifi, CircleDot } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function HardwareStatus() {
  const [syncing, setSyncing] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [device, setDevice] = useState<{ status: 'online' | 'offline' | 'busy'; battery: number | null; signal: number | null; lastSyncAt: string | null } | null>(null)

  async function loadDevice() {
    setSyncing(true)
    try {
      const response = await fetch('/api/teacher/devices', { cache: 'no-store' })
      const payload = await response.json() as { data?: typeof device }
      setUnavailable(!response.ok)
      setDevice(Array.isArray(payload.data) ? payload.data[0] ?? null : null)
    } catch {
      setUnavailable(true)
      setDevice(null)
    } finally { setSyncing(false) }
  }

  useEffect(() => { void loadDevice() }, [])

  const online = device?.status === 'online' || device?.status === 'busy'
  const battery = device?.battery
  const lastSync = device?.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString('id-ID') : 'Belum pernah'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-9 gap-2 border-border px-2.5 sm:px-3"
            aria-label="Status perangkat"
          />
        }
      >
        <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                online ? 'animate-ping bg-success' : 'bg-muted-foreground',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                online ? 'bg-success' : 'bg-muted-foreground',
              )}
            />
          </span>
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="hidden text-xs font-semibold sm:inline">
            {unavailable ? 'Belum tersedia' : online ? 'Terhubung' : 'Offline'}
          </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                TuturAI Console
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {device ? 'Perangkat terdaftar' : 'Belum ada perangkat terdaftar'}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <Row
            icon={<CircleDot className="h-4 w-4 text-success" />}
            label="Status"
            value={unavailable ? 'Belum tersedia' : online ? 'Online' : 'Offline'}
            valueClass={online ? 'text-success' : 'text-muted-foreground'}
          />
          <Row
            icon={<Battery className="h-4 w-4 text-muted-foreground" />}
            label="Baterai"
            value={battery === null || battery === undefined ? 'Belum ada' : `${battery}%`}
          />
          <Row
            icon={<Wifi className="h-4 w-4 text-muted-foreground" />}
            label="Sinyal"
            value={device?.signal === null || device?.signal === undefined ? 'Belum ada' : `${device.signal}%`}
          />
          <Row
            icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
            label="Sinkron terakhir"
            value={lastSync}
          />
        </div>
        <div className="border-t border-border p-3">
          <Button
             onClick={() => void loadDevice()}
            disabled={syncing}
            className="w-full gap-2"
            size="sm"
          >
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
             {syncing ? 'Memuat...' : 'Muat ulang status'}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Row({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn('font-semibold text-foreground', valueClass)}>
        {value}
      </span>
    </div>
  )
}
