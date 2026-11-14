export type DeviceStatus = 'online' | 'offline' | 'pairing'

export interface DeviceActivityBucket {
  hour: string
  count: number
}

export interface DeviceRow {
  id: string
  code: string
  label: string | null
  classroomId: string | null
  status: DeviceStatus
  battery: number | null
  signal: number | null
  firmware: string | null
  hardwareId: string | null
  lastSyncAt: string | null
  pairedAt: string | null
  pairingExpiresAt: string | null
  heartbeatCount: number
  activity: DeviceActivityBucket[]
  revokedAt: string | null
  createdAt: string | null
}

export interface PairingTicket {
  deviceId: string
  code: string
  expiresAt: string
}

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  pairing: 'Menunggu kode',
}

export function deviceName(device: DeviceRow) {
  return device.label?.trim() || device.code
}

export function formatRelative(iso: string | null, now: number) {
  if (!iso) return 'Belum pernah'
  const diff = now - Date.parse(iso)
  if (Number.isNaN(diff)) return 'Belum pernah'
  if (diff < 5000) return 'Baru saja'
  const seconds = Math.round(diff / 1000)
  if (seconds < 60) return `${seconds} dtk lalu`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.round(hours / 24)} hari lalu`
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
