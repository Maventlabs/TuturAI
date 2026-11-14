import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { listAssignmentSubmissions } from '@/lib/submissions'

type RouteContext = { params: Promise<{ assignmentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  try {
    const { assignmentId } = await context.params
    const data = await listAssignmentSubmissions(assignmentId, auth.user.uid)
    return NextResponse.json({ data })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Assignment was not found'), { status: 404 })
    }
    throw cause
  }
}
