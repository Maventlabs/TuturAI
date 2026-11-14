'use client'

import { Panel } from '@/components/guru/overview/panel'
import { ReadoutStrip, type Readout } from '@/components/guru/overview/readout-strip'
import { FleetActivity } from './fleet-activity'
import { BatterySpread } from './battery-spread'
import { SignalRanking } from './signal-ranking'
import { TelemetryCoverage } from './telemetry-coverage'
import { DeviceRoster } from './device-roster'
import { PairingPanel } from './pairing-panel'
import { deviceName, type DeviceActivityBucket, type DeviceRow, type PairingTicket } from './types'

const LOW_BATTERY = 20

function emptySeries(now: number): DeviceActivityBucket[] {
  const start = new Date(now)
  start.setUTCMinutes(0, 0, 0)
  return Array.from({ length: 24 }, (_, index) => ({
    hour: new Date(start.getTime() - (23 - index) * 60 * 60 * 1000).toISOString(),
    count: 0,
  }))
}

function buildHeadline(devices: DeviceRow[]) {
  if (devices.length === 0) {
    return 'Belum ada perangkat terdaftar. Buat kode pairing, masukkan kode itu di perangkat ESP32, dan unit akan muncul di sini dengan ID-nya sendiri.'
  }

  const online = devices.filter((device) => device.status === 'online').length
  const pairing = devices.filter((device) => device.status === 'pairing').length
  const offline = devices.filter((device) => device.status === 'offline').length
  const measured = devices.filter((device) => typeof device.battery === 'number')
  const lowest = measured.length
    ? measured.reduce((min, device) => ((device.battery as number) < (min.battery as number) ? device : min))
    : null

  const parts = [`${online} dari ${devices.length} perangkat mengirim heartbeat.`]
  if (pairing > 0) parts.push(`${pairing} unit menunggu kode pairing.`)
  if (offline > 0) parts.push(`${offline} unit tidak terhubung.`)
  if (lowest && (lowest.battery as number) < LOW_BATTERY) {
    parts.push(`Baterai terendah ${lowest.battery}% pada ${deviceName(lowest)}.`)
  }
  return parts.join(' ')
}

interface DeviceSheetProps {
  devices: DeviceRow[]
  ticket: PairingTicket | null
  loading: boolean
  error: string | null
  actionError: string | null
  busy: string | null
  now: number
  today: string | null
  onRetry: () => void
  onRegister: (label: string) => void
  onReissue: (deviceId: string) => void
  onRevoke: (deviceId: string) => void
  onDismissTicket: () => void
}

export function DeviceSheet({
  devices,
  ticket,
  loading,
  error,
  actionError,
  busy,
  now,
  today,
  onRetry,
  onRegister,
  onReissue,
  onRevoke,
  onDismissTicket,
}: DeviceSheetProps) {
  const online = devices.filter((device) => device.status === 'online').length
  const pairing = devices.filter((device) => device.status === 'pairing').length
  const measured = devices.filter((device) => typeof device.battery === 'number')
  const lowBattery = measured.filter((device) => (device.battery as number) < LOW_BATTERY).length
  const averageBattery = measured.length
    ? Math.round(measured.reduce((sum, device) => sum + (device.battery as number), 0) / measured.length)
    : null

  const fleetSeries = devices.length
    ? devices[0].activity.map((bucket, index) => ({
        hour: bucket.hour,
        count: devices.reduce((sum, device) => sum + (device.activity[index]?.count ?? 0), 0),
      }))
    : emptySeries(now)

  const readouts: Readout[] = [
    { label: 'Terdaftar', value: String(devices.length), note: 'unit' },
    { label: 'Online', value: String(online), note: 'heartbeat < 90 dtk' },
    { label: 'Menunggu', value: String(pairing), note: 'belum dipasangkan' },
    {
      label: 'Baterai rendah',
      value: String(lowBattery),
      note: `< ${LOW_BATTERY}%`,
      tone: lowBattery > 0 ? 'attention' : 'default',
    },
    {
      label: 'Rata-rata',
      value: averageBattery === null ? '—' : String(averageBattery),
      unit: averageBattery === null ? undefined : '%',
      note: `${measured.length} unit melapor`,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[10px] uppercase tracking-[0.12em] underline underline-offset-4"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-rule px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Armada Perangkat{today ? ` · ${today}` : ''}
            </p>
            <button
              type="button"
              onClick={() => onRegister('')}
              disabled={busy === 'register'}
              className="flex items-center gap-1.5 bg-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'register' ? 'Membuat kode' : 'Buat kode pairing'}
            </button>
          </div>

          <h1 className="mt-4 max-w-[58ch] text-balance font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
            {loading && devices.length === 0 ? 'Membaca status armada…' : buildHeadline(devices)}
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            Heartbeat 30 dtk &middot; ambang offline 90 dtk &middot; kode pairing 15 mnt
          </p>
        </div>

        <ReadoutStrip items={readouts} />

        <FleetActivity series={fleetSeries} deviceCount={devices.length} />

        {loading && devices.length === 0 ? (
          <div className="border-t border-rule px-5 py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Memuat panel
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px border-t border-rule bg-rule lg:grid-cols-3">
            <Panel label="Armada" meta={`${devices.length} unit`} className="lg:col-span-2" bodyClassName="p-0">
              <DeviceRoster
                devices={devices}
                now={now}
                busyId={busy}
                onRevoke={onRevoke}
                onReissue={onReissue}
                onRegister={() => onRegister('')}
              />
            </Panel>

            <Panel label="Pairing" meta={ticket ? 'kode aktif' : 'siap'}>
              <PairingPanel
                ticket={ticket}
                busy={busy === 'register'}
                error={actionError}
                onGenerate={onRegister}
                onDismiss={onDismissTicket}
              />
            </Panel>

            <Panel label="Sebaran Baterai" meta={`${measured.length} unit`}>
              <BatterySpread devices={devices} />
            </Panel>

            <Panel label="Kualitas Sinyal" meta="terlemah dulu">
              <SignalRanking devices={devices} />
            </Panel>

            <Panel label="Cakupan Telemetri" meta={`${devices.length} unit`}>
              <TelemetryCoverage devices={devices} />
            </Panel>
          </div>
        )}
      </div>

      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50">
        Sumber: Firestore &middot; dokumen perangkat, heartbeat, kredensial perangkat
      </p>
    </div>
  )
}
