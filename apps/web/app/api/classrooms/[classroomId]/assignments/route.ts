import { NextRequest, NextResponse } from 'next/server'
import { validateAssignmentInput } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireAuth, requireRole } from '@/lib/api/auth-guard'
import { createTeacherAssignment, listClassroomAssignments } from '@/lib/assignments'
import { readJsonBody } from '@/lib/api/request'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const { classroomId } = await context.params
    const assignments = await listClassroomAssignments(classroomId, { role: auth.profile.role, uid: auth.user.uid })
    return NextResponse.json({ data: assignments })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const rawBody = await readJsonBody(request)
  const body = rawBody && typeof rawBody === 'object' ? rawBody as Record<string, unknown> : {}
  const validation = validateAssignmentInput(body)
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid assignment input', validation.issues), { status: 400 })
  }
  const status = body.status === 'published' ? 'published' : 'draft'

  try {
    const { classroomId } = await context.params
    const assignment = await createTeacherAssignment(classroomId, auth.user.uid, validation.data, status)
    return NextResponse.json({ data: assignment }, { status: 201 })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}
