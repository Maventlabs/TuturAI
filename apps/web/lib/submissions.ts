import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore'
import { transitionSubmission, type Assessment, type Assignment, type DriveFileMetadata, type Submission, type SubmissionStatus } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'
import { assignmentFromSnapshot } from '@/lib/assignments'
import { cacheAside, invalidateNamespaces } from '@/lib/cache'
import { CACHE_NAMESPACES, CACHE_TTL } from '@/lib/cache/keys'

const ASSIGNMENTS_COLLECTION = 'assignments'
const CLASSROOMS_COLLECTION = 'classrooms'
const MEMBERSHIPS_COLLECTION = 'classMemberships'
const USERS_COLLECTION = 'users'
export const SUBMISSIONS_COLLECTION = 'submissions'

export interface TeacherReviewQueueItem {
  assignment: Assignment
  className: string
  submission: Submission
  assessment: Assessment | null
}

export function isSubmissionAwaitingReview(status: SubmissionStatus) {
  return status === 'submitted' || status === 'pending_review'
}

function toIsoString(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return typeof value === 'string' ? value : null
}

export function submissionFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): Submission {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    assignmentId: data.assignmentId,
    studentId: data.studentId,
    attempt: data.attempt,
    status: data.status,
    isLate: data.isLate,
    teacherFeedback: data.teacherFeedback ?? null,
    submittedAt: toIsoString(data.submittedAt),
    updatedAt: toIsoString(data.updatedAt) ?? new Date(0).toISOString(),
    files: Array.isArray(data.files) ? data.files as DriveFileMetadata[] : [],
  }
}

function assessmentFromData(data: DocumentData | undefined): Assessment | null {
  if (!data || typeof data.id !== 'string' || typeof data.studentId !== 'string') return null
  return data as Assessment
}

function submissionId(assignmentId: string, studentId: string) {
  return `${assignmentId}_${studentId}`
}

async function getAssignmentAndMembership(assignmentId: string, studentId: string, transaction?: FirebaseFirestore.Transaction) {
  const db = getAdminDb()
  const assignmentReference = db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId)
  const assignment = transaction ? await transaction.get(assignmentReference) : await assignmentReference.get()
  if (!assignment.exists || assignment.data()?.status !== 'published') throw new Error('ASSIGNMENT_NOT_FOUND')

  const classId = assignment.data()?.classId
  const membershipReference = db.collection(MEMBERSHIPS_COLLECTION).doc(`${classId}_${studentId}`)
  const membership = transaction ? await transaction.get(membershipReference) : await membershipReference.get()
  if (!membership.exists || membership.data()?.status !== 'active') throw new Error('CLASSROOM_NOT_FOUND')
  return { assignmentReference, assignment, classId }
}

export async function submitAssignment(assignmentId: string, studentId: string, idempotencyKey?: string) {
  const db = getAdminDb()
  const reference = db.collection(SUBMISSIONS_COLLECTION).doc(submissionId(assignmentId, studentId))
  await db.runTransaction(async (transaction) => {
    const { assignmentReference, assignment } = await getAssignmentAndMembership(assignmentId, studentId, transaction)
    const current = await transaction.get(reference)
    const assignmentData = assignment.data() ?? {}
    const currentData = current.data()
    if (idempotencyKey && currentData?.lastIdempotencyKey === idempotencyKey) return
    const state = {
      status: (currentData?.status ?? 'assigned') as SubmissionStatus,
      attempt: typeof currentData?.attempt === 'number' ? currentData.attempt : 0,
      maxAttempts: assignmentData.maxAttempts,
    }
    const next = transitionSubmission(state, 'submit')
    const now = Timestamp.now()
    const dueAt = assignmentData.dueAt instanceof Timestamp ? assignmentData.dueAt.toMillis() : null
    const submission = {
      assignmentId,
      studentId,
      attempt: next.attempt,
      status: next.status,
      isLate: dueAt !== null && now.toMillis() > dueAt,
      teacherFeedback: currentData?.teacherFeedback ?? null,
      submittedAt: now,
      updatedAt: now,
      ...(idempotencyKey ? { lastIdempotencyKey: idempotencyKey } : {}),
    }
    if (current.exists) transaction.update(reference, submission)
    else transaction.create(reference, submission)
    void assignmentReference
  })
  const submitted = submissionFromSnapshot(await reference.get())
  // A submission changes the student's dashboard and every teacher's queue.
  const assignment = await getAdminDb().collection(ASSIGNMENTS_COLLECTION).doc(assignmentId).get()
  const classroomId = assignment.data()?.classId
  if (typeof classroomId === 'string') {
    const classroom = await getAdminDb().collection(CLASSROOMS_COLLECTION).doc(classroomId).get()
    const teacherId = classroom.data()?.teacherId
    await invalidateNamespaces(
      `analytics:dashboard:${studentId}`,
      ...(typeof teacherId === 'string' ? [`reviewQueue:${teacherId}`, `analytics:${teacherId}`] : []),
    )
  }
  return submitted
}

export async function getStudentSubmission(assignmentId: string, studentId: string) {
  await getAssignmentAndMembership(assignmentId, studentId)
  const reference = getAdminDb().collection(SUBMISSIONS_COLLECTION).doc(submissionId(assignmentId, studentId))
  const snapshot = await reference.get()
  return snapshot.exists ? submissionFromSnapshot(snapshot) : null
}

export async function appendSubmissionFile(submissionIdValue: string, studentId: string, file: DriveFileMetadata) {
  const db = getAdminDb()
  const reference = db.collection(SUBMISSIONS_COLLECTION).doc(submissionIdValue)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists || snapshot.data()?.studentId !== studentId) throw new Error('SUBMISSION_NOT_FOUND')
    const files = Array.isArray(snapshot.data()?.files) ? snapshot.data()?.files as DriveFileMetadata[] : []
    if (files.some((existing) => existing.id === file.id)) return
    transaction.update(reference, { files: [...files, file], updatedAt: Timestamp.now() })
  })
  return submissionFromSnapshot(await reference.get())
}

export async function listTeacherReviewQueue(teacherId: string): Promise<TeacherReviewQueueItem[]> {
  const { value } = await cacheAside({
    key: CACHE_NAMESPACES.reviewQueue(teacherId),
    ttlSeconds: CACHE_TTL.reviewQueue,
    loader: async () => {
      const db = getAdminDb()
      const classrooms = await db.collection(CLASSROOMS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .get()

      const queue = await Promise.all(classrooms.docs.filter((classroom) => classroom.data()?.status === 'active').flatMap((classroom) => {
        const classId = classroom.id
        const className = typeof classroom.data()?.name === 'string' ? classroom.data()?.name : classId
        return [db.collection(ASSIGNMENTS_COLLECTION).where('classId', '==', classId).get().then(async (assignments) => {
          const items = await Promise.all(assignments.docs.map(async (assignmentSnapshot) => {
            const assignment = assignmentFromSnapshot(assignmentSnapshot)
            const submissions = await db.collection(SUBMISSIONS_COLLECTION)
              .where('assignmentId', '==', assignment.id)
              .get()
            const items = submissions.docs
              .map((submissionSnapshot) => ({ assignment, className, submission: submissionFromSnapshot(submissionSnapshot) }))
              .filter((item) => isSubmissionAwaitingReview(item.submission.status))
            return Promise.all(items.map(async (item) => {
              const assessments = await db.collection('assessments').where('studentId', '==', item.submission.studentId).limit(100).get()
              const latest = assessments.docs
                .map((snapshot) => assessmentFromData(snapshot.data()))
                .filter((assessment): assessment is Assessment => assessment !== null)
                .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
              return { ...item, assessment: latest }
            }))
          }))
          return items.flat()
        })]
      }))

      return queue.flat().sort((left, right) => {
        const leftTime = left.submission.submittedAt ? Date.parse(left.submission.submittedAt) : 0
        const rightTime = right.submission.submittedAt ? Date.parse(right.submission.submittedAt) : 0
        return rightTime - leftTime
      })
    },
  })
  return value
}

export interface AssignmentStudentRow {
  studentId: string
  name: string
  email: string | null
  submission: Submission | null
  assessment: Assessment | null
}

export interface AssignmentSubmissions {
  assignment: Assignment
  classId: string
  className: string
  students: AssignmentStudentRow[]
}

/**
 * Every active member of the assignment's classroom, joined with their
 * submission (if any). Students who never submitted still appear so the
 * teacher sees the full roster instead of only the ones who turned work in.
 */
export async function listAssignmentSubmissions(
  assignmentId: string,
  teacherId: string,
): Promise<AssignmentSubmissions> {
  const db = getAdminDb()
  const assignmentSnapshot = await db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId).get()
  if (!assignmentSnapshot.exists) throw new Error('ASSIGNMENT_NOT_FOUND')
  const assignment = assignmentFromSnapshot(assignmentSnapshot)

  const classroomSnapshot = await db.collection(CLASSROOMS_COLLECTION).doc(assignment.classId).get()
  if (!classroomSnapshot.exists || classroomSnapshot.data()?.teacherId !== teacherId) {
    throw new Error('ASSIGNMENT_NOT_FOUND')
  }
  const classroomData = classroomSnapshot.data() ?? {}
  const className = typeof classroomData.name === 'string' ? classroomData.name : assignment.classId

  const memberships = await db.collection(MEMBERSHIPS_COLLECTION)
    .where('classId', '==', assignment.classId)
    .where('status', '==', 'active')
    .get()
  const userReferences = memberships.docs.map((membership) =>
    db.collection(USERS_COLLECTION).doc(membership.data().studentId),
  )
  const users = userReferences.length > 0 ? await db.getAll(...userReferences) : []
  const usersById = new Map(users.map((user) => [user.id, user.data() ?? {}]))

  const submissionSnapshots = await db.collection(SUBMISSIONS_COLLECTION)
    .where('assignmentId', '==', assignmentId)
    .get()
  const submissionsByStudent = new Map(
    submissionSnapshots.docs.map((snapshot) => [
      snapshot.data().studentId as string,
      submissionFromSnapshot(snapshot),
    ]),
  )

  const students = await Promise.all(
    memberships.docs.map(async (membership): Promise<AssignmentStudentRow> => {
      const studentId = membership.data().studentId as string
      const user = usersById.get(studentId) ?? {}
      const submission = submissionsByStudent.get(studentId) ?? null
      let assessment: Assessment | null = null
      if (submission) {
        const assessments = await db.collection('assessments').where('studentId', '==', studentId).limit(100).get()
        assessment = assessments.docs
          .map((snapshot) => assessmentFromData(snapshot.data()))
          .filter((item): item is Assessment => item !== null)
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
      }
      return {
        studentId,
        name: typeof user.displayName === 'string'
          ? user.displayName
          : typeof user.full_name === 'string'
            ? user.full_name
            : 'Siswa',
        email: typeof user.email === 'string' ? user.email : null,
        submission,
        assessment,
      }
    }),
  )

  students.sort((left, right) => left.name.localeCompare(right.name, 'id'))

  return { assignment, classId: assignment.classId, className, students }
}

async function assertTeacherOwnsAssignment(assignmentId: string, teacherId: string, transaction: FirebaseFirestore.Transaction) {
  const db = getAdminDb()
  const assignmentReference = db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId)
  const assignment = await transaction.get(assignmentReference)
  if (!assignment.exists) throw new Error('ASSIGNMENT_NOT_FOUND')
  const classroom = await transaction.get(db.collection(CLASSROOMS_COLLECTION).doc(assignment.data()?.classId))
  if (!classroom.exists || classroom.data()?.teacherId !== teacherId) throw new Error('ASSIGNMENT_NOT_FOUND')
  return assignmentReference
}

export async function reviewSubmission(submissionIdValue: string, teacherId: string, action: 'approve' | 'return', feedback: string | null) {
  const db = getAdminDb()
  const reference = db.collection(SUBMISSIONS_COLLECTION).doc(submissionIdValue)
  await db.runTransaction(async (transaction) => {
    const submission = await transaction.get(reference)
    if (!submission.exists) throw new Error('SUBMISSION_NOT_FOUND')
    const assignmentId = submission.data()?.assignmentId
    await assertTeacherOwnsAssignment(assignmentId, teacherId, transaction)
    const data = submission.data() ?? {}
    const assignment = await transaction.get(db.collection(ASSIGNMENTS_COLLECTION).doc(assignmentId))
    const next = transitionSubmission({
      status: data.status as SubmissionStatus,
      attempt: data.attempt,
      maxAttempts: assignment.data()?.maxAttempts,
    }, action)
    transaction.update(reference, {
      status: next.status,
      teacherFeedback: feedback,
      updatedAt: Timestamp.now(),
    })
  })
  const reviewed = submissionFromSnapshot(await reference.get())
  await invalidateNamespaces(
    `reviewQueue:${teacherId}`,
    `assignments:${reviewed.assignmentId}`,
    `analytics:${teacherId}`,
    `analytics:dashboard:${reviewed.studentId}`,
  )
  return reviewed
}
