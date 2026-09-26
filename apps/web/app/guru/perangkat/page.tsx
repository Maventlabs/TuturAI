'use client'

import { useEffect, useState } from 'react'
import {
  Cpu,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  RefreshCw,
  Signal,
  Plus,
  CircleDot,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { cn } from '@/lib/utils'

type DeviceInfo = {
  id: string
  code: string
  student: string
  battery: number
  firmware: string
  lastSync: string
  status: 'online' | 'offline' | 'busy'
  signal: number
}

type DevicePayload = {
  data?: Array<Partial<DeviceInfo> & { id: string; code: string; lastSyncAt?: string | null }>
  error?: { message?: string }
}

const STATUS_META = {
  online: { label: 'Online', color: 'text-[var(--chart-3)]', dot: 'bg-[var(--chart-3)]', icon: Wifi },
  busy: { label: 'Sinkron', color: 'text-[var(--chart-4)]', dot: 'bg-[var(--chart-4)]', icon: RefreshCw },
  offline: { label: 'Offline', color: 'text-muted-foreground', dot: 'bg-muted-foreground', icon: WifiOff },
} as const

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [classroomId, setClassroomId] = useState('')
  const [registrationSecret, setRegistrationSecret] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDevices() {
      setLoading(true)
      setError(null)
      setUnavailable(false)

      try {
        const response = await fetch('/api/teacher/devices', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json() as DevicePayload

        if (!response.ok) {
          throw new Error(payload.error?.message ?? 'Gagal memuat perangkat')
        }

        if (!Array.isArray(payload.data)) {
          throw new Error('Respons status perangkat tidak valid')
        }

        setDevices((payload.data ?? []).map((device) => ({
          ...device,
          student: device.student ?? 'Belum ditetapkan',
          status: device.status ?? 'offline',
          battery: device.battery ?? 0,
          signal: device.signal ?? 0,
          firmware: device.firmware ?? 'Belum terdeteksi',
          lastSync: device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString('id-ID') : 'Belum pernah',
        })))
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat perangkat')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadDevices()
    return () => controller.abort()
  }, [reloadKey])

  const online = devices.filter((d) => d.status !== 'offline').length
  const lowBattery = devices.filter((d) => d.battery < 20).length
  const avgBattery = Math.round(
    devices.length > 0
      ? devices.reduce((a, d) => a + d.battery, 0) / devices.length
      : 0,
  )

  async function handleSync() {
    setSyncing('device')
    setActionError('Sinkronisasi perangkat belum tersedia tanpa koneksi cloud perangkat.')
    setSyncing(null)
  }

  async function register() {
    setActionError(null)
    try {
      const response = await fetch('/api/teacher/devices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId, classroomId: classroomId || undefined }) })
      const payload = await response.json() as { data?: { secret?: string }; error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message ?? 'Pendaftaran perangkat gagal')
      setRegistrationSecret(payload.data?.secret ?? null)
      setDeviceId('')
      setClassroomId('')
      setReloadKey((current) => current + 1)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Pendaftaran perangkat gagal')
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Perangkat TuturAI"
        description="Pantau dan kelola perangkat speaking berbasis ESP32 milik siswa."
      >
        <Button
          size="sm"
          className="gap-2"
          onClick={() => { setShowRegister((current) => !current); setRegistrationSecret(null) }}
        >
          <Plus className="h-4 w-4" />
          Daftarkan Perangkat
        </Button>
      </PageHeader>

      {showRegister && <Card className="p-5" aria-label="Daftarkan perangkat">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm font-medium">Device ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="esp32-class-01" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm" /></label>
          <label className="space-y-1 text-sm font-medium">Classroom ID (opsional)<input value={classroomId} onChange={(event) => setClassroomId(event.target.value)} placeholder="classroom-id" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm" /></label>
          <Button onClick={() => void register()} disabled={!deviceId.trim()}>Daftarkan</Button>
        </div>
        {registrationSecret && <p className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">Credential perangkat dibuat. Simpan sekali sekarang: <code className="break-all font-mono">{registrationSecret}</code></p>}
      </Card>}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((current) => current + 1)}>
            Coba lagi
          </Button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status" aria-busy="true">
          Memuat status perangkat...
        </Card>
      ) : unavailable ? (
        <Card className="p-6" role="status">
          <p className="font-medium text-foreground">Status perangkat belum tersedia</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Integrasi perangkat belum dikonfigurasi. Tidak ada status atau tindakan yang disimulasikan.
          </p>
        </Card>
      ) : error ? null : (
        <>
          <FadeInStagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <FadeInItem>
              <KpiCard label="Total Perangkat" value={devices.length} icon={Cpu} tone="primary" />
            </FadeInItem>
            <FadeInItem>
              <KpiCard label="Terhubung" value={online} icon={Wifi} tone="success" />
            </FadeInItem>
            <FadeInItem>
              <KpiCard label="Baterai Rendah" value={lowBattery} icon={BatteryLow} tone="destructive" />
            </FadeInItem>
            <FadeInItem>
              <KpiCard label="Rata-rata Baterai" value={avgBattery} suffix="%" icon={Battery} tone="accent" />
            </FadeInItem>
          </FadeInStagger>

          {devices.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground" role="status">
              Belum ada perangkat yang terdaftar.
            </Card>
          ) : (
            <FadeInStagger className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {devices.map((d) => {
          const meta = STATUS_META[d.status]
          const isSyncing = syncing === 'device'
          return (
            <FadeInItem key={d.id}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Cpu className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {d.code}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.student}</p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn('gap-1.5', meta.color)}
                  >
                    <span className="relative flex h-2 w-2">
                      {d.status === 'online' && (
                        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', meta.dot)} />
                      )}
                      <span className={cn('relative inline-flex h-2 w-2 rounded-full', meta.dot)} />
                    </span>
                    {meta.label}
                  </Badge>
                </div>

                <div className="mt-5 space-y-3">
                  {/* Battery */}
                  <div className="flex items-center gap-3">
                    <Battery className="h-4 w-4 text-muted-foreground" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          d.battery < 20
                            ? 'bg-destructive'
                            : d.battery < 50
                              ? 'bg-[var(--chart-4)]'
                              : 'bg-[var(--chart-3)]',
                        )}
                        style={{ width: `${d.battery}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-foreground">
                      {d.battery}%
                    </span>
                  </div>
                  {/* Signal */}
                  <div className="flex items-center gap-3">
                    <Signal className="h-4 w-4 text-muted-foreground" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${d.signal}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-foreground">
                      {d.signal > 0 ? `${d.signal}%` : '—'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <CircleDot className="h-3 w-3" />
                      Firmware {d.firmware}
                    </p>
                    <p className="mt-0.5">Sinkron: {d.lastSync}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={d.status === 'offline' || syncing !== null}
                    onClick={handleSync}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                    {isSyncing ? 'Sinkron…' : 'Sinkron'}
                  </Button>
                </div>
              </Card>
            </FadeInItem>
          )
              })}
            </FadeInStagger>
          )}
        </>
      )}
    </div>
  )
}
