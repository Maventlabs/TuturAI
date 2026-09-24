import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { reviewSubmission } from '@/lib/submissions'

type RouteContext = { params: Promise<{ submissionId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : ''
  if (!feedback) return NextResponse.json(apiError('VALIDATION_ERROR', 'Feedback is required when returning a submission'), { status: 400 })
  try {
    const { submissionId } = await context.params
    const submission = await reviewSubmission(submissionId, auth.user.uid, 'return', feedback)
    return NextResponse.json({ data: submission })
  } catch (cause) {
    if (cause instanceof Error && ['SUBMISSION_NOT_FOUND', 'ASSIGNMENT_NOT_FOUND'].includes(cause.message)) {
      return NextResponse.json(apiError('NOT_FOUND', 'Submission was not found'), { status: 404 })
    }
    if (cause instanceof Error && cause.message === 'APPROVED_TERMINAL') {
      return NextResponse.json(apiError('CONFLICT', 'Approved submissions cannot change'), { status: 409 })
    }
    throw cause
  }
}
