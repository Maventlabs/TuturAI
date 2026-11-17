import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getReadingSessionState } from '@/lib/reading'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ attemptId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const { attemptId } = await context.params
  const session = await getReadingSessionState({ studentId: auth.user.uid, attemptId })
  if (!session) {
    return NextResponse.json(apiError('NOT_FOUND', 'Sesi reading tidak ditemukan'), { status: 404 })
  }

  return NextResponse.json({ data: session }, { headers: { 'cache-control': 'no-store' } })
}
