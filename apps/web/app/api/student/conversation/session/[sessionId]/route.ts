import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getConversationSession, loadConversationTurns } from '@/lib/conversation/store'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const { sessionId } = await context.params
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(sessionId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid sessionId is required'), { status: 400 })
  }

  const session = await getConversationSession(auth.user.uid, sessionId)
  if (!session) {
    return NextResponse.json(apiError('NOT_FOUND', 'Conversation session was not found'), { status: 404 })
  }

  const turns = await loadConversationTurns(auth.user.uid, sessionId)
  return NextResponse.json({ data: { session, turns } }, { headers: { 'cache-control': 'no-store' } })
}
