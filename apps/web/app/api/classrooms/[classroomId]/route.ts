import { NextRequest, NextResponse } from 'next/server'
import { validateClassroomInput, validateClassroomStatus } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { updateTeacherClassroom } from '@/lib/classrooms'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const body = await request.json() as Record<string, unknown>
  const validation = validateClassroomInput(body)
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid classroom input', validation.issues), { status: 400 })
  }
  const status = validateClassroomStatus(body.status)
  if (!status.success) return NextResponse.json(apiError('VALIDATION_ERROR', status.message), { status: 400 })

  try {
    const { classroomId } = await context.params
    const classroom = await updateTeacherClassroom(classroomId, auth.user.uid, validation.data, status.value)
    return NextResponse.json({ data: classroom })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}
