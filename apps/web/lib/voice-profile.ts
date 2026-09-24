import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import type { VoiceEnrollmentResult } from '@/lib/ai/voice-provider'

export type VoiceProfileStatus = 'processing' | 'ready' | 'failed'

export interface VoiceProfile {
  id: string
  teacherId: string
  provider: 'omnivoice'
  providerVoiceId: string
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
  return {
    id,
    teacherId: String(value.teacherId),
    provider: 'omnivoice',
    providerVoiceId: String(value.providerVoiceId),
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

export async function saveTeacherVoiceProfile(teacherId: string, enrollment: VoiceEnrollmentResult, consentAt: string) {
  const ref = getAdminDb().collection('voiceProfiles').doc(teacherId)
  await ref.set({
    teacherId,
    provider: 'omnivoice',
    providerVoiceId: enrollment.providerVoiceId,
    status: enrollment.status,
    consentAt,
    errorCode: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const snapshot = await ref.get()
  return serializeVoiceProfile(teacherId, snapshot.data() ?? {})
}

export async function deleteTeacherVoiceProfile(teacherId: string) {
  await getAdminDb().collection('voiceProfiles').doc(teacherId).delete()
}
