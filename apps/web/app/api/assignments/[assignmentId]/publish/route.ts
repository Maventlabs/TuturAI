import { NextRequest, NextResponse } from 'next/server'
import { AssignmentRuleError } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import { publishTeacherAssignment } from '@/lib/assignments'

type RouteContext = { params: Promise<{ assignmentId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const startedAt = performance.now()
  const requestId = getRequestId(request)

  try {
    const { assignmentId } = await context.params
    const assignment = await publishTeacherAssignment(assignmentId, auth.user.uid)
    return NextResponse.json({ data: assignment }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Assignment was not found', { requestId }), { status: 404 })
    }
    if (cause instanceof AssignmentRuleError) {
      return NextResponse.json(apiError('CONFLICT', cause.message, { code: cause.code, requestId }), { status: 409 })
    }
    logApiFailure({ requestId, route: '/api/assignments/[assignmentId]/publish', status: 500, errorCode: 'ASSIGNMENT_PUBLISH_FAILED', provider: 'firestore', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Assignment could not be published', { code: 'ASSIGNMENT_PUBLISH_FAILED', retryable: true, requestId }), { status: 500 })
  }
}
