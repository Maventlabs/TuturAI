import { NextResponse } from 'next/server'
import { isValidTeacherScore } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { gradeSubmission } from '@/lib/submissions'

type RouteContext = { params: Promise<{ submissionId: string }> }

function parseScore(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const score = parseScore(body.score)
  if (score === undefined || (score !== null && !isValidTeacherScore(score))) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Score must be a whole number between 1 and 100'),
      { status: 400 },
    )
  }
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() || null : undefined

  try {
    const { submissionId } = await context.params
    const submission = await gradeSubmission(submissionId, auth.user.uid, score, feedback)
    return NextResponse.json({ data: submission })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'INVALID_SCORE') {
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Score must be a whole number between 1 and 100'),
        { status: 400 },
      )
    }
    if (cause instanceof Error && ['SUBMISSION_NOT_FOUND', 'ASSIGNMENT_NOT_FOUND'].includes(cause.message)) {
      return NextResponse.json(apiError('NOT_FOUND', 'Submission was not found'), { status: 404 })
    }
    throw cause
  }
}
