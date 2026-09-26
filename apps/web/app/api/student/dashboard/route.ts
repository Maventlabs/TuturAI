import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { listClassroomLeaderboard, listStudentClassrooms } from '@/lib/classrooms'
import { listClassroomAssignments } from '@/lib/assignments'
import { getStudentSubmission } from '@/lib/submissions'
import { getAdminDb } from '@/lib/firebase/admin'
import { buildDashboardInsights } from '@/lib/dashboard-insights'

export async function GET(request?: Request) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    const db = getAdminDb()
    const [userSnapshot, attemptsSnapshot] = await Promise.all([
      db.collection('users').doc(auth.user.uid).get(),
      db.collection('questionAttempts').where('studentId', '==', auth.user.uid).limit(200).get(),
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
    const classrooms = await listStudentClassrooms(auth.user.uid)
    const classroomById = new Map(classrooms.map((classroom) => [classroom.id, classroom]))
    const requestedClassroomId = request ? new URL(request.url).searchParams.get('classroomId') : null
    const activeClassroom = requestedClassroomId ? classroomById.get(requestedClassroomId) : classrooms[0]
    if (requestedClassroomId && !activeClassroom) {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    const activeClassrooms = activeClassroom ? [activeClassroom] : []
    const leaderboard = activeClassroom ? await listClassroomLeaderboard(activeClassroom.id, auth.user.uid) : []
    const assignments = (await Promise.all(activeClassrooms.map(async (classroom) => {
      const classroomAssignments = await listClassroomAssignments(classroom.id, { role: 'student', uid: auth.user.uid })
      return Promise.all(classroomAssignments.map(async (assignment) => ({
        ...assignment,
        classroomName: classroom.name,
        submission: await getStudentSubmission(assignment.id, auth.user.uid),
      })))
    }))).flat()

    assignments.sort((left, right) => {
      if (left.dueAt === null) return 1
      if (right.dueAt === null) return -1
      return left.dueAt.localeCompare(right.dueAt)
    })

    return NextResponse.json({
      data: {
        profile: {
          ...auth.profile,
          streak: typeof userSnapshot.data()?.streak === 'number' ? userSnapshot.data()?.streak : null,
          rank: leaderboard.find((row) => row.studentId === auth.user.uid)?.rank ?? null,
        },
        classrooms: [...classroomById.values()],
        activeClassroomId: activeClassroom?.id ?? null,
        assignments,
        leaderboard,
        insights: buildDashboardInsights(attempts),
      },
    })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}
