import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { regenerateTeacherJoinKey, revokeTeacherJoinKey } from '@/lib/classrooms'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const body = await request.json() as { action?: unknown }
  if (body.action !== 'regenerate' && body.action !== 'revoke') {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Action must be regenerate or revoke'), { status: 400 })
  }

  try {
    const { classroomId } = await context.params
    if (body.action === 'regenerate') {
      const joinKey = await regenerateTeacherJoinKey(classroomId, auth.user.uid)
      return NextResponse.json({ data: { joinKey } })
    }
    await revokeTeacherJoinKey(classroomId, auth.user.uid)
    return NextResponse.json({ data: { revoked: true } })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}
