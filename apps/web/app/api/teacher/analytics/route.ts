import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { listTeacherClassrooms, listTeacherClassroomMembers } from '@/lib/classrooms'
import { buildTeacherAnalytics, type AnalyticsAssessment, type AnalyticsAttempt, type AnalyticsPeriod } from '@/lib/teacher-analytics'
import { cacheAside } from '@/lib/cache'
import { CACHE_NAMESPACES, CACHE_TTL } from '@/lib/cache/keys'

function millis(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value === 'string') return Date.parse(value) || 0
  return 0
}

export async function GET(request: Request) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const requestedPeriod = new URL(request.url).searchParams.get('period')
  const period: AnalyticsPeriod = requestedPeriod === '7d' || requestedPeriod === '30d' ? requestedPeriod : 'all'

  // This aggregate fans out into 2N queries (attempts + assessments per student),
  // so it is the single most expensive read on the teacher dashboard.
  const { value } = await cacheAside({
    key: CACHE_NAMESPACES.teacherAnalytics(auth.user.uid, period),
    ttlSeconds: CACHE_TTL.analytics,
    loader: async () => {
      const db = getAdminDb()
      const classrooms = await listTeacherClassrooms(auth.user.uid)
      const memberships = await Promise.all(classrooms.map((classroom) => listTeacherClassroomMembers(classroom.id, auth.user.uid)))
      const studentIds = [...new Set(memberships.flat().map((member) => member.studentId))]
      const questionAttemptSnapshots = await Promise.all(studentIds.map((studentId) => db.collection('questionAttempts').where('studentId', '==', studentId).limit(200).get()))
      const assessmentSnapshots = await Promise.all(studentIds.map((studentId) => db.collection('assessments').where('studentId', '==', studentId).limit(100).get()))
      const questionIds = [...new Set(questionAttemptSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.data().questionId).filter((id): id is string => typeof id === 'string')))]
      const questionSnapshots = questionIds.length ? await db.getAll(...questionIds.map((id) => db.collection('questionBank').doc(id))) : []
      const skillByQuestion = new Map(questionSnapshots.map((snapshot) => [snapshot.id, snapshot.data()?.skill ?? 'unknown']))
      const attempts: AnalyticsAttempt[] = questionAttemptSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => {
        const data = doc.data()
        return { studentId: data.studentId, isCorrect: data.isCorrect === true, createdAt: millis(data.createdAt), skill: skillByQuestion.get(data.questionId) ?? 'unknown' }
      }))
      const assessments: AnalyticsAssessment[] = assessmentSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => {
        const data = doc.data()
        return { studentId: data.studentId, overall: data.overall, fluency: data.fluency, createdAt: millis(data.createdAt) }
      }))

      return buildTeacherAnalytics({
        classrooms: classrooms.map((classroom, index) => ({ id: classroom.id, name: classroom.name, studentCount: memberships[index].length })),
        attempts,
        assessments,
        period,
      })
    },
  })

  return NextResponse.json({ data: value })
}
