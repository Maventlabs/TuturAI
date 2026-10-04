import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { listClassroomLeaderboard, listStudentClassrooms } from '@/lib/classrooms'
import { listClassroomAssignments } from '@/lib/assignments'
import { getStudentSubmission } from '@/lib/submissions'
import { getAdminDb } from '@/lib/firebase/admin'
import { buildDashboardInsights } from '@/lib/dashboard-insights'
import { cacheAside } from '@/lib/cache'
import { CACHE_NAMESPACES, CACHE_TTL } from '@/lib/cache/keys'
import type { FirebaseProfile } from '@/lib/firebase/session'

export async function GET(request?: Request) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    return await buildDashboardResponse(request, auth.user.uid, auth.profile)
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}

async function buildDashboardResponse(request: Request | undefined, uid: string, profile: FirebaseProfile) {
  const requestedClassroomId = request ? new URL(request.url).searchParams.get('classroomId') : null
  // The payload depends on which classroom tab is active, so the id is part of
  // the cache key.
  const { value } = await cacheAside({
    key: `${CACHE_NAMESPACES.studentDashboard(uid)}:${requestedClassroomId ?? 'first'}`,
    ttlSeconds: CACHE_TTL.analytics,
    loader: async () => {
      const db = getAdminDb()
      const [userSnapshot, attemptsSnapshot] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('questionAttempts').where('studentId', '==', uid).limit(200).get(),
      ])
      const attempts = attemptsSnapshot.docs.map((doc) => {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate?.() ?? data.createdAt
        return {
          id: doc.id,
          questionId: typeof data.questionId === 'string' ? data.questionId : undefined,
          isCorrect: typeof data.isCorrect === 'boolean' ? data.isCorrect : undefined,
          createdAt: createdAt instanceof Date ? createdAt.toISOString() : typeof createdAt === 'string' ? createdAt : undefined,
        }
      })
      const classrooms = await listStudentClassrooms(uid)
      const classroomById = new Map(classrooms.map((classroom) => [classroom.id, classroom]))
      const activeClassroom = requestedClassroomId ? classroomById.get(requestedClassroomId) : classrooms[0]
      if (requestedClassroomId && !activeClassroom) throw new Error('CLASSROOM_NOT_FOUND')
      const activeClassrooms = activeClassroom ? [activeClassroom] : []
      const leaderboard = activeClassroom ? await listClassroomLeaderboard(activeClassroom.id, uid) : []
      const assignments = (await Promise.all(activeClassrooms.map(async (classroom) => {
        const classroomAssignments = await listClassroomAssignments(classroom.id, { role: 'student', uid })
        return Promise.all(classroomAssignments.map(async (assignment) => ({
          ...assignment,
          classroomName: classroom.name,
          submission: await getStudentSubmission(assignment.id, uid),
        })))
      }))).flat()

      assignments.sort((left, right) => {
        if (left.dueAt === null) return 1
        if (right.dueAt === null) return -1
        return left.dueAt.localeCompare(right.dueAt)
      })

      return {
        profile: {
          ...profile,
          streak: typeof userSnapshot.data()?.streak === 'number' ? userSnapshot.data()?.streak : null,
          rank: leaderboard.find((row) => row.studentId === uid)?.rank ?? null,
        },
        classrooms: [...classroomById.values()],
        activeClassroomId: activeClassroom?.id ?? null,
        assignments,
        leaderboard,
        insights: buildDashboardInsights(attempts),
      }
    },
  })

  return NextResponse.json({ data: value })
}
