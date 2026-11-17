import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getQuizAttemptState } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ attemptId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const { attemptId } = await context.params
  const attempt = await getQuizAttemptState({ studentId: auth.user.uid, attemptId })
  if (!attempt) {
    return NextResponse.json(apiError('NOT_FOUND', 'Quiz attempt was not found'), { status: 404 })
  }

  return NextResponse.json({ data: attempt }, { headers: { 'cache-control': 'no-store' } })
}
