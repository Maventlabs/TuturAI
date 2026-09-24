import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { listTeacherClassrooms, listTeacherClassroomMembers } from '@/lib/classrooms'
import { buildTeacherAnalytics, type AnalyticsAssessment, type AnalyticsAttempt, type AnalyticsPeriod } from '@/lib/teacher-analytics'
import { createReportPdf } from '@/lib/report-pdf'

function millis(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value === 'string') return Date.parse(value) || 0
  if (typeof value === 'number') return value
  return 0
}

export async function GET(request: Request) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const params = new URL(request.url).searchParams
  const classroomId = params.get('classroomId')
  const studentId = params.get('studentId')
  const requestedPeriod = params.get('period')
  const period: AnalyticsPeriod = requestedPeriod === '7d' || requestedPeriod === '30d' ? requestedPeriod : 'all'
  const classrooms = await listTeacherClassrooms(auth.user.uid)
  const selectedClassrooms = classroomId ? classrooms.filter((classroom) => classroom.id === classroomId) : classrooms
  if (classroomId && selectedClassrooms.length === 0) return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })

  const memberships = await Promise.all(selectedClassrooms.map((classroom) => listTeacherClassroomMembers(classroom.id, auth.user.uid)))
  const allowedStudentIds = new Set(memberships.flat().map((member) => member.studentId))
  if (studentId && !allowedStudentIds.has(studentId)) return NextResponse.json(apiError('FORBIDDEN', 'Student is not in a classroom managed by this teacher'), { status: 403 })
  const targetStudentIds = studentId ? [studentId] : [...allowedStudentIds]
  const db = getAdminDb()
  const [attemptSnapshots, assessmentSnapshots] = await Promise.all([
    Promise.all(targetStudentIds.map((id) => db.collection('questionAttempts').where('studentId', '==', id).limit(200).get())),
    Promise.all(targetStudentIds.map((id) => db.collection('assessments').where('studentId', '==', id).limit(100).get())),
  ])
  const attempts: AnalyticsAttempt[] = attemptSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => {
    const data = doc.data()
    return { studentId: data.studentId, isCorrect: data.isCorrect === true, createdAt: millis(data.createdAt), skill: typeof data.skill === 'string' ? data.skill : 'unknown' }
  }))
  const assessments: AnalyticsAssessment[] = assessmentSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => {
    const data = doc.data()
    return { studentId: data.studentId, overall: data.overall, createdAt: millis(data.createdAt) }
  }))
  const analytics = buildTeacherAnalytics({
    classrooms: selectedClassrooms.map((classroom, index) => ({ id: classroom.id, name: classroom.name, studentCount: studentId ? 1 : memberships[index].length })),
    attempts,
    assessments,
    period,
  })
  const scope = studentId ? `Siswa: ${studentId}` : classroomId ? `Kelas: ${selectedClassrooms[0].name}` : 'Semua kelas yang dikelola'
  const pdf = createReportPdf([
    'TuturAI Learning Report',
    scope,
    `Periode: ${period === 'all' ? 'semua waktu' : period}`,
    `Jumlah kelas: ${analytics.summary.classroomCount}`,
    `Jumlah siswa: ${analytics.summary.studentCount}`,
    `Attempt latihan: ${analytics.summary.practiceAttempts}`,
    `Akurasi latihan: ${analytics.summary.practiceAccuracy === null ? 'belum tersedia' : `${analytics.summary.practiceAccuracy}%`}`,
    `Rata-rata speaking: ${analytics.summary.averageSpeakingScore === null ? 'belum tersedia' : `${analytics.summary.averageSpeakingScore}%`}`,
    `Common errors: ${analytics.commonErrors.length ? analytics.commonErrors.map((item) => `${item.skill} (${item.errors})`).join(', ') : 'belum tersedia'}`,
  ])

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tuturai-report-${studentId ?? classroomId ?? 'teacher'}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
