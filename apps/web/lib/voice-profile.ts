import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import type { VoiceEnrollmentResult } from '@/lib/ai/voice-provider'

export type VoiceProfileStatus = 'processing' | 'ready' | 'failed'

export interface VoiceProfile {
  id: string
  teacherId: string
  provider: 'omnivoice'
  providerVoiceId: string | null
  status: VoiceProfileStatus
  consentAt: string
  createdAt: string | null
  updatedAt: string | null
  errorCode: string | null
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return null
}

export function serializeVoiceProfile(id: string, value: Record<string, unknown>): VoiceProfile {
  if (!['processing', 'ready', 'failed'].includes(String(value.status))) {
    throw new Error('INVALID_VOICE_PROFILE_STATE')
  }
  return {
    id,
    teacherId: String(value.teacherId),
    provider: 'omnivoice',
    providerVoiceId: typeof value.providerVoiceId === 'string' && value.providerVoiceId ? value.providerVoiceId : null,
    status: value.status as VoiceProfileStatus,
    consentAt: String(value.consentAt),
    createdAt: toIso(value.createdAt),
    updatedAt: toIso(value.updatedAt),
    errorCode: typeof value.errorCode === 'string' ? value.errorCode : null,
  }
}

export async function getTeacherVoiceProfile(teacherId: string) {
  const snapshot = await getAdminDb().collection('voiceProfiles').doc(teacherId).get()
  return snapshot.exists ? serializeVoiceProfile(teacherId, snapshot.data() ?? {}) : null
}

export async function getTeacherVoiceProfileState(teacherId: string) {
  const snapshot = await getAdminDb().collection('voiceProfiles').doc(teacherId).get()
  if (!snapshot.exists) return { profile: null, idempotencyKey: null, requestHash: null }
  const data = snapshot.data() ?? {}
  return {
    profile: serializeVoiceProfile(teacherId, data),
    idempotencyKey: typeof data.idempotencyKey === 'string' ? data.idempotencyKey : null,
    requestHash: typeof data.requestHash === 'string' ? data.requestHash : null,
  }
}

export async function getStudentClassroomVoiceProfile(studentId: string, classroomId: string) {
  const db = getAdminDb()
  const classroom = await db.collection('classrooms').doc(classroomId).get()
  if (!classroom.exists || classroom.data()?.status !== 'active') throw new Error('CLASSROOM_NOT_FOUND')

  const membership = await db.collection('classMemberships').doc(`${classroomId}_${studentId}`).get()
  if (!membership.exists || membership.data()?.studentId !== studentId || membership.data()?.status !== 'active') {
    throw new Error('CLASSROOM_NOT_FOUND')
  }

  return getTeacherVoiceProfile(String(classroom.data()?.teacherId))
}

export async function startTeacherVoiceEnrollment(teacherId: string, idempotencyKey: string, requestHash: string, consentAt: string) {
  const db = getAdminDb()
  const ref = db.collection('voiceProfiles').doc(teacherId)
  let started = false
  await db.runTransaction(async (transaction) => {
    started = false
    const snapshot = await transaction.get(ref)
    const existing = snapshot.data()
    if (snapshot.exists && existing?.status === 'ready') throw new Error('VOICE_PROFILE_DELETE_REQUIRED')
    if (snapshot.exists && existing?.status === 'processing') {
      if (existing.idempotencyKey === idempotencyKey && existing.requestHash === requestHash) return
      if (existing.idempotencyKey === idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REUSED')
      throw new Error('VOICE_PROFILE_PROCESSING')
    }
    started = true
    transaction.set(ref, {
      teacherId,
      provider: 'omnivoice',
      providerVoiceId: null,
      status: 'processing',
      consentAt,
      idempotencyKey,
      requestHash,
      errorCode: null,
      createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  const snapshot = await ref.get()
  return { profile: serializeVoiceProfile(teacherId, snapshot.data() ?? {}), started }
}

export async function saveTeacherVoiceProfile(teacherId: string, enrollment: VoiceEnrollmentResult) {
  const ref = getAdminDb().collection('voiceProfiles').doc(teacherId)
  await ref.update({
    providerVoiceId: enrollment.providerVoiceId,
    status: enrollment.status,
    errorCode: enrollment.errorCode ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  })
  const snapshot = await ref.get()
  return serializeVoiceProfile(teacherId, snapshot.data() ?? {})
}

export async function updateTeacherVoiceProfileStatus(teacherId: string, status: VoiceProfileStatus, errorCode: string | null = null, providerVoiceId?: string | null) {
  const ref = getAdminDb().collection('voiceProfiles').doc(teacherId)
  await ref.update({
    status,
    errorCode,
    ...(providerVoiceId !== undefined ? { providerVoiceId } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const snapshot = await ref.get()
  return serializeVoiceProfile(teacherId, snapshot.data() ?? {})
}

export async function failTeacherVoiceEnrollment(teacherId: string, errorCode: string) {
  return updateTeacherVoiceProfileStatus(teacherId, 'failed', errorCode)
}

export async function deleteTeacherVoiceProfile(teacherId: string) {
  await getAdminDb().collection('voiceProfiles').doc(teacherId).delete()
}
