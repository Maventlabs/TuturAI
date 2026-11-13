import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

export type DeviceStatus = 'online' | 'offline' | 'pairing'

/** How often the firmware is expected to call the heartbeat endpoint. */
export const HEARTBEAT_INTERVAL_SECONDS = 30
/** Three missed heartbeats before the fleet view stops calling a device online. */
export const ONLINE_WINDOW_MS = HEARTBEAT_INTERVAL_SECONDS * 3 * 1000
/** A pairing code is single-use and short-lived; the teacher re-issues on demand. */
export const PAIRING_TTL_MS = 15 * 60 * 1000
/** Hourly heartbeat buckets kept on the device document for the activity chart. */
export const ACTIVITY_BUCKETS = 24

// No I, O, 0 or 1: the code is read off the dashboard and typed on a keypad.
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PAIRING_LENGTH = 6

export interface DeviceActivityBucket {
  /** ISO timestamp for the start of the hour bucket. */
  hour: string
  count: number
}

export interface DeviceRecord {
  id: string
  code: string
  label: string | null
  ownerTeacherId: string
  classroomId: string | null
  studentId: string | null
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
  credentialVersion: number
  revokedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type DeviceHeartbeat = { battery?: number; signal?: number; firmware?: string; hardwareId?: string }

export type ClaimResult =
  | { ok: true; deviceId: string; secret: string }
  | { ok: false; reason: 'invalid' | 'expired' }

export function parseDeviceHeartbeat(value: unknown): DeviceHeartbeat | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some((key) => !['battery', 'signal', 'firmware', 'hardwareId'].includes(key))) return null

  const telemetry: DeviceHeartbeat = {}
  for (const key of ['battery', 'signal'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) return null
    telemetry[key] = value
  }

  for (const key of ['firmware', 'hardwareId'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) return null
    telemetry[key] = value.trim()
  }

  return telemetry
}

export function isValidDeviceId(value: string) {
  return /^[A-Za-z0-9_-]{4,64}$/.test(value)
}

export function createDeviceId() {
  return `esp32-${randomBytes(4).toString('hex')}`
}

export function createDeviceSecret() {
  return randomBytes(32).toString('base64url')
}

export async function hashDeviceSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

export async function verifyDeviceSecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(await hashDeviceSecret(secret), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createPairingCode() {
  const bytes = randomBytes(PAIRING_LENGTH)
  let compact = ''
  for (const byte of bytes) compact += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]
  return `${compact.slice(0, 3)}-${compact.slice(3)}`
}

/** Accepts `K7F-2QP`, `k7f2qp` or `K7F 2QP` and returns the canonical compact form. */
export function normalizePairingCode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.length !== PAIRING_LENGTH) return null
  for (const char of compact) {
    if (!PAIRING_ALPHABET.includes(char)) return null
  }
  return compact
}

export async function hashPairingCode(code: string) {
  const compact = normalizePairingCode(code)
  if (!compact) throw new Error('INVALID_PAIRING_CODE')
  return createHash('sha256').update(compact).digest('hex')
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString()
  return null
}

function hourKey(date: Date) {
  return date.toISOString().slice(0, 13).replace(/[-T]/g, '')
}

function hourStart(date: Date) {
  const start = new Date(date.getTime())
  start.setUTCMinutes(0, 0, 0)
  return start
}

/**
 * Expands the stored hourly counters into a fixed 24-bucket series so the chart
 * always has the same shape, including hours with no heartbeat at all.
 */
export function buildActivitySeries(raw: unknown, now = new Date()): DeviceActivityBucket[] {
  const counts = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const series: DeviceActivityBucket[] = []
  for (let offset = ACTIVITY_BUCKETS - 1; offset >= 0; offset -= 1) {
    const start = hourStart(new Date(now.getTime() - offset * 60 * 60 * 1000))
    const count = counts[hourKey(start)]
    series.push({ hour: start.toISOString(), count: typeof count === 'number' ? count : 0 })
  }
  return series
}

/**
 * Status is derived, never trusted from the stored field: a device that stopped
 * sending heartbeats must read as offline even though its last write said online.
 */
export function deriveDeviceStatus(value: Record<string, unknown>, now = Date.now()): DeviceStatus {
  if (value.revokedAt != null) return 'offline'
  if (typeof value.credentialHash !== 'string' || value.credentialHash.length === 0) return 'pairing'
  const lastSyncAt = toIso(value.lastSyncAt)
  if (!lastSyncAt) return 'offline'
  return now - Date.parse(lastSyncAt) <= ONLINE_WINDOW_MS ? 'online' : 'offline'
}

export function serializeDevice(id: string, value: Record<string, unknown>, now = Date.now()): DeviceRecord {
  return {
    id,
    code: String(value.code ?? id),
    label: typeof value.label === 'string' ? value.label : null,
    ownerTeacherId: String(value.ownerTeacherId),
    classroomId: typeof value.classroomId === 'string' ? value.classroomId : null,
    studentId: typeof value.studentId === 'string' ? value.studentId : null,
    status: deriveDeviceStatus(value, now),
    battery: typeof value.battery === 'number' ? value.battery : null,
    signal: typeof value.signal === 'number' ? value.signal : null,
    firmware: typeof value.firmware === 'string' ? value.firmware : null,
    hardwareId: typeof value.hardwareId === 'string' ? value.hardwareId : null,
    lastSyncAt: toIso(value.lastSyncAt),
    pairedAt: toIso(value.pairedAt),
    pairingExpiresAt: toIso(value.pairingExpiresAt),
    heartbeatCount: typeof value.heartbeatCount === 'number' ? value.heartbeatCount : 0,
    activity: buildActivitySeries(value.activity, new Date(now)),
    credentialVersion: typeof value.credentialVersion === 'number' ? value.credentialVersion : 1,
    revokedAt: toIso(value.revokedAt),
    createdAt: toIso(value.createdAt),
    updatedAt: toIso(value.updatedAt),
  }
}

export async function listTeacherDevices(teacherId: string) {
  const snapshot = await getAdminDb().collection('devices').where('ownerTeacherId', '==', teacherId).limit(100).get()
  const now = Date.now()
  return snapshot.docs
    // Revoked units stay in Firestore for audit but leave the fleet view.
    .filter((doc) => doc.data().revokedAt == null)
    .map((doc) => serializeDevice(doc.id, doc.data(), now))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
}

export async function getDevice(deviceId: string) {
  const snapshot = await getAdminDb().collection('devices').doc(deviceId).get()
  return snapshot.exists ? serializeDevice(snapshot.id, snapshot.data() ?? {}) : null
}

export async function registerDevice(input: {
  deviceId: string
  teacherId: string
  classroomId: string | null
  label: string | null
  pairingCodeHash: string
  pairingExpiresAt: Date
}) {
  const ref = getAdminDb().collection('devices').doc(input.deviceId)
  const existing = await ref.get()
  if (existing.exists && existing.data()?.revokedAt == null) throw new Error('DEVICE_ALREADY_REGISTERED')
  await ref.set({
    code: input.deviceId,
    label: input.label,
    ownerTeacherId: input.teacherId,
    classroomId: input.classroomId,
    studentId: null,
    status: 'pairing',
    battery: null,
    signal: null,
    firmware: null,
    hardwareId: null,
    lastSyncAt: null,
    pairedAt: null,
    pairingCodeHash: input.pairingCodeHash,
    pairingExpiresAt: input.pairingExpiresAt,
    credentialHash: null,
    credentialVersion: (existing.data()?.credentialVersion ?? 0) + 1,
    heartbeatCount: 0,
    activity: {},
    revokedAt: null,
    createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return getDevice(input.deviceId)
}

/** Re-issues a pairing code for a device that has not been claimed yet. */
export async function issuePairingCode(
  deviceId: string,
  teacherId: string,
  input: { pairingCodeHash: string; pairingExpiresAt: Date },
) {
  const ref = getAdminDb().collection('devices').doc(deviceId)
  const existing = await ref.get()
  if (!existing.exists || existing.data()?.ownerTeacherId !== teacherId) throw new Error('DEVICE_NOT_FOUND')
  const data = existing.data() ?? {}
  if (data.revokedAt != null) throw new Error('DEVICE_REVOKED')
  if (typeof data.credentialHash === 'string' && data.credentialHash.length > 0) throw new Error('DEVICE_ALREADY_PAIRED')
  await ref.update({
    pairingCodeHash: input.pairingCodeHash,
    pairingExpiresAt: input.pairingExpiresAt,
    status: 'pairing',
    updatedAt: FieldValue.serverTimestamp(),
  })
  return getDevice(deviceId)
}

/**
 * Exchanges a single-use pairing code for the device credential. The secret is
 * only ever returned to the device that claimed the code, never to the browser.
 */
export async function claimDevice(input: { code: string; hardwareId: string | null; firmware: string | null }): Promise<ClaimResult> {
  const compact = normalizePairingCode(input.code)
  if (!compact) return { ok: false, reason: 'invalid' }

  const snapshot = await getAdminDb()
    .collection('devices')
    .where('pairingCodeHash', '==', await hashPairingCode(compact))
    .limit(1)
    .get()
  if (snapshot.empty) return { ok: false, reason: 'invalid' }

  const doc = snapshot.docs[0]
  const data = doc.data()
  if (data.revokedAt != null) return { ok: false, reason: 'invalid' }

  const expiresAt = toIso(data.pairingExpiresAt)
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return { ok: false, reason: 'expired' }

  const secret = createDeviceSecret()
  await doc.ref.update({
    credentialHash: await hashDeviceSecret(secret),
    credentialVersion: (typeof data.credentialVersion === 'number' ? data.credentialVersion : 0) + 1,
    hardwareId: input.hardwareId,
    firmware: input.firmware,
    pairedAt: FieldValue.serverTimestamp(),
    pairingCodeHash: FieldValue.delete(),
    pairingExpiresAt: FieldValue.delete(),
    status: 'online',
    lastSyncAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { ok: true, deviceId: doc.id, secret }
}

export async function revokeDevice(deviceId: string, teacherId: string) {
  const ref = getAdminDb().collection('devices').doc(deviceId)
  const existing = await ref.get()
  if (!existing.exists || existing.data()?.ownerTeacherId !== teacherId) throw new Error('DEVICE_NOT_FOUND')
  await ref.update({
    revokedAt: FieldValue.serverTimestamp(),
    status: 'offline',
    pairingCodeHash: FieldValue.delete(),
    pairingExpiresAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function updateDeviceHeartbeat(deviceId: string, telemetry: DeviceHeartbeat, existing: Record<string, unknown>) {
  const now = new Date()
  const currentKey = hourKey(now)
  const cutoffKey = hourKey(new Date(now.getTime() - (ACTIVITY_BUCKETS - 1) * 60 * 60 * 1000))
  const stored = (typeof existing.activity === 'object' && existing.activity !== null ? existing.activity : {}) as Record<string, unknown>

  const activity: Record<string, number> = {}
  for (const [bucket, count] of Object.entries(stored)) {
    if (bucket >= cutoffKey && typeof count === 'number') activity[bucket] = count
  }
  activity[currentKey] = (activity[currentKey] ?? 0) + 1

  await getAdminDb().collection('devices').doc(deviceId).update({
    ...(telemetry.battery !== undefined ? { battery: telemetry.battery } : {}),
    ...(telemetry.signal !== undefined ? { signal: telemetry.signal } : {}),
    ...(telemetry.firmware !== undefined ? { firmware: telemetry.firmware } : {}),
    ...(telemetry.hardwareId !== undefined ? { hardwareId: telemetry.hardwareId } : {}),
    status: 'online',
    lastSyncAt: FieldValue.serverTimestamp(),
    heartbeatCount: FieldValue.increment(1),
    activity,
    updatedAt: FieldValue.serverTimestamp(),
  })
}
