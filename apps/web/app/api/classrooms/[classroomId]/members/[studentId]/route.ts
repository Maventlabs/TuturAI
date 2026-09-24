import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { removeTeacherClassroomMember } from '@/lib/classrooms'

type RouteContext = { params: Promise<{ classroomId: string; studentId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  try {
    const { classroomId, studentId } = await context.params
    await removeTeacherClassroomMember(classroomId, auth.user.uid, studentId)
    return new NextResponse(null, { status: 204 })
  } catch (cause) {
    if (cause instanceof Error && (cause.message === 'CLASSROOM_NOT_FOUND' || cause.message === 'MEMBERSHIP_NOT_FOUND')) {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom member was not found'), { status: 404 })
    }
    throw cause
  }
}
