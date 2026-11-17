import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { readingErrorResponse } from '@/lib/api/reading-errors'
import { submitReadingSession } from '@/lib/reading'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ attemptId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const { attemptId } = await context.params

  try {
    const session = await submitReadingSession({ studentId: auth.user.uid, attemptId })
    return NextResponse.json({ data: session }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const response = readingErrorResponse(error)
    if (response) return response
    throw error
  }
}
