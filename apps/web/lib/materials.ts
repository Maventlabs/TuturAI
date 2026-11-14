import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore'
import type { DriveFileMetadata, Material, MaterialInput, MaterialStatus } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'
import { cacheAside, invalidateNamespaces } from '@/lib/cache'
import { CACHE_NAMESPACES, CACHE_TTL } from '@/lib/cache/keys'

export const MATERIALS_COLLECTION = 'materials'
const CLASSROOMS_COLLECTION = 'classrooms'
const MEMBERSHIPS_COLLECTION = 'classMemberships'

function toIsoString(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return typeof value === 'string' ? value : null
}

export function materialFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): Material {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    classId: data.classId,
    title: data.title,
    description: data.description,
    topic: data.topic ?? null,
    attachments: Array.isArray(data.attachments) ? data.attachments as DriveFileMetadata[] : [],
    status: data.status,
    createdAt: toIsoString(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date(0).toISOString(),
  }
}

async function assertTeacherOwnsClassroom(classroomId: string, teacherId: string) {
  const classroom = await getAdminDb().collection(CLASSROOMS_COLLECTION).doc(classroomId).get()
  if (!classroom.exists || classroom.data()?.teacherId !== teacherId || classroom.data()?.status !== 'active') {
    throw new Error('CLASSROOM_NOT_FOUND')
  }
}

async function assertStudentMember(classroomId: string, studentId: string) {
  const membership = await getAdminDb().collection(MEMBERSHIPS_COLLECTION).doc(`${classroomId}_${studentId}`).get()
  if (!membership.exists || membership.data()?.status !== 'active') throw new Error('CLASSROOM_NOT_FOUND')
}

export async function createTeacherMaterial(
  classroomId: string,
  teacherId: string,
  input: MaterialInput,
  status: MaterialStatus,
) {
  await assertTeacherOwnsClassroom(classroomId, teacherId)
  const now = Timestamp.now()
  const reference = getAdminDb().collection(MATERIALS_COLLECTION).doc()
  await reference.create({
    ...input,
    classId: classroomId,
    attachments: [],
    status,
    createdAt: now,
    updatedAt: now,
  })
  await invalidateNamespaces(`materials:${classroomId}`)
  return materialFromSnapshot(await reference.get())
}

export async function listClassroomMaterials(
  classroomId: string,
  actor: { role: 'teacher' | 'student'; uid: string },
) {
  // Same split as assignments: the authorization gate stays uncached, only the
  // list itself is cached, and the role is part of the key because students
  // only ever see published material.
  if (actor.role === 'teacher') await assertTeacherOwnsClassroom(classroomId, actor.uid)
  else await assertStudentMember(classroomId, actor.uid)

  const { value } = await cacheAside({
    key: `${CACHE_NAMESPACES.classroomMaterials(classroomId)}:${actor.role}`,
    ttlSeconds: CACHE_TTL.materials,
    loader: async () => {
      const snapshot = await getAdminDb().collection(MATERIALS_COLLECTION).where('classId', '==', classroomId).get()
      return snapshot.docs
        .map(materialFromSnapshot)
        .filter((material) => actor.role === 'teacher' || material.status === 'published')
    },
  })
  return value
}
