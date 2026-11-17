import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { listClassroomAssignments } from '@/lib/assignments'
import { listTeacherClassroomMembers, listTeacherClassrooms } from '@/lib/classrooms'
import { listAssignmentSubmissions } from '@/lib/submissions'
import { buildGradebook, type GradebookInput } from '@/lib/gradebook'
import { buildGradebookWorkbook, gradebookExportFilename } from '@/lib/gradebook-export'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const { classroomId } = await context.params
  const classrooms = await listTeacherClassrooms(auth.user.uid)
  const classroom = classrooms.find((entry) => entry.id === classroomId)
  if (!classroom) {
    return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
  }

  const [members, assignments] = await Promise.all([
    listTeacherClassroomMembers(classroomId, auth.user.uid),
    listClassroomAssignments(classroomId, { role: 'teacher', uid: auth.user.uid }),
  ])
  const published = assignments.filter((assignment) => assignment.status === 'published')

  const payloads = await Promise.all(
    published.map((assignment) => listAssignmentSubmissions(assignment.id, auth.user.uid)),
  )
  const inputs: GradebookInput[] = payloads.map((payload) => ({
    assignment: { id: payload.assignment.id, title: payload.assignment.title },
    students: payload.students,
  }))

  const roster = members.map((member) => ({
    studentId: member.studentId,
    name: member.name,
    email: member.email,
  }))
  const gradebook = buildGradebook(inputs, roster)
  const generatedAt = new Date()

  const workbook = await buildGradebookWorkbook({
    className: classroom.name,
    gradebook,
    assignments: published.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt,
    })),
    roster: roster.map((entry) => ({ studentId: entry.studentId, email: entry.email })),
    generatedAt,
  })

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${gradebookExportFilename(classroom.name, generatedAt)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
