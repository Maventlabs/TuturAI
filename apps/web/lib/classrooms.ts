import { createHash, randomBytes } from 'node:crypto'
import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore'
import type { Classroom, ClassroomInput, RecordStatus } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'

export const CLASSROOMS_COLLECTION = 'classrooms'
export const MEMBERSHIPS_COLLECTION = 'classMemberships'
const USERS_COLLECTION = 'users'
const JOIN_RATE_LIMIT_COLLECTION = 'joinRateLimits'
const JOIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const JOIN_RATE_LIMIT_MAX_ATTEMPTS = 10

export function hashJoinKey(joinKey: string) {
  return createHash('sha256').update(joinKey).digest('hex')
}

export function createJoinKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('')
}

export async function createUniqueJoinKey() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinKey = createJoinKey()
    const existing = await getAdminDb()
      .collection(CLASSROOMS_COLLECTION)
      .where('joinKeyHash', '==', hashJoinKey(joinKey))
      .limit(1)
      .get()
    if (existing.empty) return joinKey
  }
  throw new Error('JOIN_KEY_GENERATION_FAILED')
}

export async function createTeacherClassroom(teacherId: string, input: ClassroomInput) {
  const db = getAdminDb()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinKey = createJoinKey()
    const classroomReference = db.collection(CLASSROOMS_COLLECTION).doc()
    const reservationReference = db.collection('classroomJoinKeys').doc(hashJoinKey(joinKey))
    const now = Timestamp.now()

    try {
      await db.runTransaction(async (transaction) => {
        const reservation = await transaction.get(reservationReference)
        if (reservation.exists) throw new Error('JOIN_KEY_COLLISION')
        transaction.create(reservationReference, { classroomId: classroomReference.id, createdAt: now })
        transaction.create(classroomReference, {
          ...input,
          teacherId,
          status: 'active',
          joinKeyHash: hashJoinKey(joinKey),
          joinKeyRevoked: false,
          createdAt: now,
          updatedAt: now,
        })
      })
      return { classroom: classroomFromSnapshot(await classroomReference.get()), joinKey }
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'JOIN_KEY_COLLISION') continue
      throw cause
    }
  }

  throw new Error('JOIN_KEY_GENERATION_FAILED')
}

export function classroomFromSnapshot(snapshot: DocumentSnapshot<DocumentData>) : Classroom {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    teacherId: data.teacherId,
    name: data.name,
    description: data.description ?? null,
    school: data.school ?? null,
    status: data.status,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  }
}

function toIsoString(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return typeof value === 'string' ? value : new Date(0).toISOString()
}

export async function listTeacherClassrooms(teacherId: string) {
  const snapshot = await getAdminDb()
    .collection(CLASSROOMS_COLLECTION)
    .where('teacherId', '==', teacherId)
    .get()
  return snapshot.docs.map(classroomFromSnapshot)
}

export async function listStudentClassrooms(studentId: string) {
  const memberships = await getAdminDb()
    .collection(MEMBERSHIPS_COLLECTION)
    .where('studentId', '==', studentId)
    .get()

  const references = memberships.docs
    .filter((membership) => membership.data().status === 'active')
    .map((membership) => getAdminDb().collection(CLASSROOMS_COLLECTION).doc(membership.data().classId))
  const snapshots = references.length > 0 ? await getAdminDb().getAll(...references) : []
  const classrooms = snapshots.map((classroom) => (classroom.exists ? classroomFromSnapshot(classroom) : null))
  return classrooms.filter((classroom): classroom is Classroom => classroom !== null && classroom.status === 'active')
}

export async function updateTeacherClassroom(
  classroomId: string,
  teacherId: string,
  input: ClassroomInput,
  status: RecordStatus,
) {
  const db = getAdminDb()
  const reference = db.collection(CLASSROOMS_COLLECTION).doc(classroomId)
  const now = Timestamp.now()
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists || snapshot.data()?.teacherId !== teacherId) throw new Error('CLASSROOM_NOT_FOUND')
    transaction.update(reference, { ...input, status, updatedAt: now })
  })
  return classroomFromSnapshot(await reference.get())
}

export async function regenerateTeacherJoinKey(classroomId: string, teacherId: string) {
  const db = getAdminDb()
  const reference = db.collection(CLASSROOMS_COLLECTION).doc(classroomId)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinKey = createJoinKey()
    const collision = await db.collection(CLASSROOMS_COLLECTION)
      .where('joinKeyHash', '==', hashJoinKey(joinKey))
      .limit(1)
      .get()
    const reservationReference = db.collection('classroomJoinKeys').doc(hashJoinKey(joinKey))
    if (!collision.empty && collision.docs[0].id !== classroomId) continue

    const now = Timestamp.now()
    try {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference)
        const reservation = await transaction.get(reservationReference)
        if (!snapshot.exists || snapshot.data()?.teacherId !== teacherId) throw new Error('CLASSROOM_NOT_FOUND')
        if (reservation.exists && reservation.data()?.classroomId !== classroomId) throw new Error('JOIN_KEY_COLLISION')
        if (!reservation.exists) transaction.create(reservationReference, { classroomId, createdAt: now })
        transaction.update(reference, { joinKeyHash: hashJoinKey(joinKey), joinKeyRevoked: false, updatedAt: now })
      })
      return joinKey
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'JOIN_KEY_COLLISION') continue
      throw cause
    }
  }

  throw new Error('JOIN_KEY_GENERATION_FAILED')
}

export async function revokeTeacherJoinKey(classroomId: string, teacherId: string) {
  const db = getAdminDb()
  const reference = db.collection(CLASSROOMS_COLLECTION).doc(classroomId)
  const now = Timestamp.now()
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists || snapshot.data()?.teacherId !== teacherId) throw new Error('CLASSROOM_NOT_FOUND')
    transaction.update(reference, { joinKeyRevoked: true, updatedAt: now })
  })
}

export async function consumeJoinAttempt(studentId: string) {
  const db = getAdminDb()
  const reference = db.collection(JOIN_RATE_LIMIT_COLLECTION).doc(studentId)
  const now = Timestamp.now()

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference)
    const data = snapshot.data()
    const windowStartedAt = data?.windowStartedAt instanceof Timestamp ? data.windowStartedAt.toMillis() : 0
    const windowExpired = now.toMillis() - windowStartedAt >= JOIN_RATE_LIMIT_WINDOW_MS
    if (windowExpired || !snapshot.exists) {
      transaction.set(reference, { windowStartedAt: now, attempts: 1, updatedAt: now })
      return
    }
    const attempts = typeof data?.attempts === 'number' ? data.attempts : 0
    if (attempts >= JOIN_RATE_LIMIT_MAX_ATTEMPTS) throw new Error('JOIN_RATE_LIMITED')
    transaction.update(reference, { attempts: attempts + 1, updatedAt: now })
  })
}

export type ClassroomMember = {
  studentId: string
  name: string
  email: string | null
  joinedAt: string
  level: number | null
  streak: number | null
  speakingScore: number | null
}

export type ClassroomLeaderboardRow = {
  rank: number
  studentId: string
  name: string
  xp: number
}

export async function listClassroomLeaderboard(classroomId: string, studentId: string): Promise<ClassroomLeaderboardRow[]> {
  const db = getAdminDb()
  const membershipReference = db.collection(MEMBERSHIPS_COLLECTION).doc(`${classroomId}_${studentId}`)
  const membership = await membershipReference.get()
  if (!membership.exists || membership.data()?.status !== 'active') throw new Error('CLASSROOM_NOT_FOUND')

  const memberships = await db.collection(MEMBERSHIPS_COLLECTION)
    .where('classId', '==', classroomId)
    .get()
  const activeMemberships = memberships.docs.filter((item) => item.data().status === 'active')
  const userReferences = activeMemberships.map((item) => db.collection(USERS_COLLECTION).doc(item.data().studentId))
  const users = userReferences.length > 0 ? await db.getAll(...userReferences) : []
  const rows = users.map((user) => {
    const data = user.data() ?? {}
    return {
      studentId: user.id,
      name: typeof data.displayName === 'string' ? data.displayName : 'Siswa',
      xp: typeof data.xp === 'number' && data.xp >= 0 ? data.xp : 0,
    }
  }).sort((left, right) => right.xp - left.xp || left.name.localeCompare(right.name))

  return rows.map((row, index) => ({ ...row, rank: index + 1 }))
}

export async function listTeacherClassroomMembers(classroomId: string, teacherId: string) {
  const db = getAdminDb()
  const classroom = await db.collection(CLASSROOMS_COLLECTION).doc(classroomId).get()
  if (!classroom.exists || classroom.data()?.teacherId !== teacherId) throw new Error('CLASSROOM_NOT_FOUND')

  const memberships = await db.collection(MEMBERSHIPS_COLLECTION)
    .where('classId', '==', classroomId)
    .where('status', '==', 'active')
    .get()
  const userReferences = memberships.docs.map((membership) => db.collection(USERS_COLLECTION).doc(membership.data().studentId))
  const users = userReferences.length > 0 ? await db.getAll(...userReferences) : []
  const usersById = new Map(users.map((user) => [user.id, user.data() ?? {}]))
  const assessmentSnapshots = await Promise.all(
    memberships.docs.map((membership) => db.collection('assessments').where('studentId', '==', membership.data().studentId).limit(100).get()),
  )

  return memberships.docs.map((membership, index): ClassroomMember => {
    const data = membership.data()
    const user = usersById.get(data.studentId) ?? {}
    const scores = assessmentSnapshots[index].docs
      .map((assessment) => assessment.data().overall)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)
    return {
      studentId: data.studentId,
      name: typeof user.displayName === 'string' ? user.displayName : typeof user.full_name === 'string' ? user.full_name : 'Siswa',
      email: typeof user.email === 'string' ? user.email : null,
      joinedAt: toIsoString(data.joinedAt),
      level: typeof user.level === 'number' && user.level >= 1 ? user.level : null,
      streak: typeof user.streak === 'number' && user.streak >= 0 ? user.streak : null,
      speakingScore: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null,
    }
  })
}

export async function removeTeacherClassroomMember(classroomId: string, teacherId: string, studentId: string) {
  const db = getAdminDb()
  const classroomReference = db.collection(CLASSROOMS_COLLECTION).doc(classroomId)
  const membershipReference = db.collection(MEMBERSHIPS_COLLECTION).doc(`${classroomId}_${studentId}`)
  await db.runTransaction(async (transaction) => {
    const classroom = await transaction.get(classroomReference)
    if (!classroom.exists || classroom.data()?.teacherId !== teacherId) throw new Error('CLASSROOM_NOT_FOUND')
    const membership = await transaction.get(membershipReference)
    if (!membership.exists) throw new Error('MEMBERSHIP_NOT_FOUND')
    transaction.delete(membershipReference)
  })
}
