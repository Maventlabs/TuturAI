import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import { getSpeakingAttempt } from '@/lib/speaking/attempts'

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)
  const { sessionId } = await context.params

  if (!/^[A-Za-z0-9_-]{1,120}$/.test(sessionId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid sessionId is required', { requestId }), { status: 400 })
  }

  try {
    const attempt = await getSpeakingAttempt(auth.user.uid, sessionId)
    if (!attempt) {
      return NextResponse.json(apiError('NOT_FOUND', 'Speaking result was not found', { requestId }), { status: 404 })
    }
    return NextResponse.json({ data: attempt }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch {
    logApiFailure({
      requestId,
      route: '/api/student/speaking/assessments/[sessionId]',
      status: 500,
      errorCode: 'SPEAKING_READBACK_FAILED',
      provider: 'firestore',
      durationMs: 0,
    })
    return NextResponse.json(
      apiError('INTERNAL_ERROR', 'Speaking result could not be loaded', {
        code: 'SPEAKING_READBACK_FAILED',
        retryable: true,
        requestId,
      }),
      { status: 500 },
    )
  }
}
