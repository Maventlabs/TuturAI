import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { listTeacherClassroomMembers } from '@/lib/classrooms'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  try {
    const { classroomId } = await context.params
    const members = await listTeacherClassroomMembers(classroomId, auth.user.uid)
    return NextResponse.json({ data: members })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}
