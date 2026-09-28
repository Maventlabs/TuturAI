import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore'
import { transitionAssignment, AssignmentRuleError, type Assignment, type AssignmentInput, type AssignmentStatus, type DriveFileMetadata } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'

export const ASSIGNMENTS_COLLECTION = 'assignments'
const CLASSROOMS_COLLECTION = 'classrooms'
const MEMBERSHIPS_COLLECTION = 'classMemberships'

function toIsoString(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return typeof value === 'string' ? value : null
}

export function assignmentFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): Assignment {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    classId: data.classId,
    title: data.title,
    instructions: data.instructions,
    dueAt: toIsoString(data.dueAt),
    maxAttempts: data.maxAttempts,
    status: data.status,
    createdAt: toIsoString(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date(0).toISOString(),
    attachments: Array.isArray(data.attachments) ? data.attachments as DriveFileMetadata[] : [],
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

export async function createTeacherAssignment(classroomId: string, teacherId: string, input: AssignmentInput, status: AssignmentStatus) {
  await assertTeacherOwnsClassroom(classroomId, teacherId)
  const now = Timestamp.now()
  const reference = getAdminDb().collection(ASSIGNMENTS_COLLECTION).doc()
  await reference.create({
    ...input,
    classId: classroomId,
    dueAt: input.dueAt ? Timestamp.fromDate(new Date(input.dueAt)) : null,
    status,
    createdAt: now,
    updatedAt: now,
  })
  return assignmentFromSnapshot(await reference.get())
}

export async function listClassroomAssignments(classroomId: string, actor: { role: 'teacher' | 'student'; uid: string }) {
  if (actor.role === 'teacher') await assertTeacherOwnsClassroom(classroomId, actor.uid)
  else await assertStudentMember(classroomId, actor.uid)

  const snapshot = await getAdminDb().collection(ASSIGNMENTS_COLLECTION).where('classId', '==', classroomId).get()
  return snapshot.docs
    .map(assignmentFromSnapshot)
    .filter((assignment) => actor.role === 'teacher' || assignment.status === 'published')
}

export async function getTeacherAssignmentDriveContext(assignmentId: string, teacherId: string) {
  const assignment = await getAdminDb().collection(ASSIGNMENTS_COLLECTION).doc(assignmentId).get()
  const classroomId = assignment.data()?.classId
  const classroom = classroomId ? await getAdminDb().collection(CLASSROOMS_COLLECTION).doc(classroomId).get() : null
  if (!assignment.exists || !classroom?.exists || classroom.data()?.teacherId !== teacherId || classroom.data()?.status !== 'active') {
    throw new Error('ASSIGNMENT_NOT_FOUND')
  }
  return { assignment: assignmentFromSnapshot(assignment), classroomId }
}

export async function appendAssignmentAttachment(assignmentId: string, teacherId: string, attachment: DriveFileMetadata) {
  const db = getAdminDb()
  const reference = db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId)
  await db.runTransaction(async (transaction) => {
    const assignment = await transaction.get(reference)
    const classroomId = assignment.data()?.classId
    const classroomReference = typeof classroomId === 'string' ? db.collection(CLASSROOMS_COLLECTION).doc(classroomId) : null
    const classroom = classroomReference ? await transaction.get(classroomReference) : null
    if (!assignment.exists || !classroom?.exists || classroom.data()?.teacherId !== teacherId || classroom.data()?.status !== 'active') {
      throw new Error('ASSIGNMENT_NOT_FOUND')
    }
    const current = Array.isArray(assignment.data()?.attachments) ? assignment.data()?.attachments as DriveFileMetadata[] : []
    if (current.some((file) => file.id === attachment.id)) return
    transaction.update(reference, { attachments: [...current, attachment], updatedAt: Timestamp.now() })
  })
  return assignmentFromSnapshot(await reference.get())
}

export async function publishTeacherAssignment(assignmentId: string, teacherId: string) {
  const db = getAdminDb()
  const reference = db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId)
  await db.runTransaction(async (transaction) => {
    const assignment = await transaction.get(reference)
    const classroomId = assignment.data()?.classId
    const classroom = typeof classroomId === 'string'
      ? await transaction.get(db.collection(CLASSROOMS_COLLECTION).doc(classroomId))
      : null
    if (!assignment.exists || !classroom?.exists || classroom.data()?.teacherId !== teacherId || classroom.data()?.status !== 'active') {
      throw new Error('ASSIGNMENT_NOT_FOUND')
    }
    const status = transitionAssignment(assignment.data()?.status as AssignmentStatus, 'publish')
    if (status !== 'published') throw new AssignmentRuleError('INVALID_TRANSITION', 'Assignment could not be published')
    transaction.update(reference, { status, updatedAt: Timestamp.now() })
  })
  return assignmentFromSnapshot(await reference.get())
}

export async function getStudentAssignmentDriveContext(assignmentId: string, studentId: string) {
  const db = getAdminDb()
  const assignmentSnapshot = await db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId).get()
  const classId = assignmentSnapshot.data()?.classId
  const classroom = classId ? await db.collection(CLASSROOMS_COLLECTION).doc(classId).get() : null
  const membership = classId ? await db.collection(MEMBERSHIPS_COLLECTION).doc(`${classId}_${studentId}`).get() : null
  if (!assignmentSnapshot.exists || assignmentSnapshot.data()?.status !== 'published') throw new Error('ASSIGNMENT_NOT_FOUND')
  if (!classroom?.exists || classroom.data()?.status !== 'active' || !membership?.exists || membership.data()?.status !== 'active') throw new Error('CLASSROOM_NOT_FOUND')
  return { assignment: assignmentFromSnapshot(assignmentSnapshot), classroomId: classId as string, teacherId: classroom.data()?.teacherId as string }
}
