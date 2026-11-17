import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { quizErrorResponse } from '@/lib/api/quiz-errors'
import { submitQuizAttempt } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ attemptId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const { attemptId } = await context.params

  try {
    const attempt = await submitQuizAttempt({ studentId: auth.user.uid, attemptId })
    return NextResponse.json({ data: attempt }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const response = quizErrorResponse(error)
    if (response) return response
    throw error
  }
}
