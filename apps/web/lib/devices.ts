import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

export type DeviceStatus = 'online' | 'offline' | 'busy'

export interface DeviceRecord {
  id: string
  code: string
  ownerTeacherId: string
  classroomId: string | null
  studentId: string | null
  status: DeviceStatus
  battery: number | null
  signal: number | null
  firmware: string | null
  lastSyncAt: string | null
  credentialVersion: number
  revokedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export function isValidDeviceId(value: string) {
  return /^[A-Za-z0-9_-]{4,64}$/.test(value)
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

function toIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString()
  return null
}

export function serializeDevice(id: string, value: Record<string, unknown>): DeviceRecord {
  return {
    id,
    code: String(value.code ?? id),
    ownerTeacherId: String(value.ownerTeacherId),
    classroomId: typeof value.classroomId === 'string' ? value.classroomId : null,
    studentId: typeof value.studentId === 'string' ? value.studentId : null,
    status: value.status as DeviceStatus,
    battery: typeof value.battery === 'number' ? value.battery : null,
    signal: typeof value.signal === 'number' ? value.signal : null,
    firmware: typeof value.firmware === 'string' ? value.firmware : null,
    lastSyncAt: toIso(value.lastSyncAt),
    credentialVersion: typeof value.credentialVersion === 'number' ? value.credentialVersion : 1,
    revokedAt: toIso(value.revokedAt),
    createdAt: toIso(value.createdAt),
    updatedAt: toIso(value.updatedAt),
  }
}

export async function listTeacherDevices(teacherId: string) {
  const snapshot = await getAdminDb().collection('devices').where('ownerTeacherId', '==', teacherId).limit(100).get()
  return snapshot.docs.map((doc) => serializeDevice(doc.id, doc.data()))
}

export async function getDevice(deviceId: string) {
  const snapshot = await getAdminDb().collection('devices').doc(deviceId).get()
  return snapshot.exists ? serializeDevice(snapshot.id, snapshot.data() ?? {}) : null
}

export async function registerDevice(input: { deviceId: string; teacherId: string; classroomId: string | null; secretHash: string }) {
  const ref = getAdminDb().collection('devices').doc(input.deviceId)
  const existing = await ref.get()
  if (existing.exists && existing.data()?.revokedAt == null) throw new Error('DEVICE_ALREADY_REGISTERED')
  await ref.set({
    code: input.deviceId,
    ownerTeacherId: input.teacherId,
    classroomId: input.classroomId,
    studentId: null,
    status: 'offline',
    battery: null,
    signal: null,
    firmware: null,
    lastSyncAt: null,
    credentialHash: input.secretHash,
    credentialVersion: (existing.data()?.credentialVersion ?? 0) + 1,
    revokedAt: null,
    createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return getDevice(input.deviceId)
}

export async function revokeDevice(deviceId: string, teacherId: string) {
  const ref = getAdminDb().collection('devices').doc(deviceId)
  const existing = await ref.get()
  if (!existing.exists || existing.data()?.ownerTeacherId !== teacherId) throw new Error('DEVICE_NOT_FOUND')
  await ref.update({ revokedAt: FieldValue.serverTimestamp(), status: 'offline', updatedAt: FieldValue.serverTimestamp() })
}

export async function updateDeviceHeartbeat(deviceId: string, input: { battery?: number; signal?: number; firmware?: string }) {
  const ref = getAdminDb().collection('devices').doc(deviceId)
  const existing = await ref.get()
  if (!existing.exists || existing.data()?.revokedAt != null) throw new Error('DEVICE_NOT_FOUND')
  await ref.update({
    ...(input.battery !== undefined ? { battery: input.battery } : {}),
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
    ...(input.firmware !== undefined ? { firmware: input.firmware } : {}),
    status: 'online',
    lastSyncAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}
