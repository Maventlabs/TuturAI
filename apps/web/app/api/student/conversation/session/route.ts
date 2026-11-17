import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import {
  CONVERSATION_LEVELS,
  CONVERSATION_MODES,
  findConversationStarter,
  type ConversationLevel,
  type ConversationMode,
} from '@tuturai/domain'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'
import { createConversationSession, listConversationSessions } from '@/lib/conversation/store'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const sessions = await listConversationSessions(auth.user.uid)
  return NextResponse.json({ data: { sessions } }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request)
  const value = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  const level: ConversationLevel =
    typeof value.level === 'string' && (CONVERSATION_LEVELS as readonly string[]).includes(value.level)
      ? (value.level as ConversationLevel)
      : 'beginner'
  const mode: ConversationMode =
    typeof value.mode === 'string' && (CONVERSATION_MODES as readonly string[]).includes(value.mode)
      ? (value.mode as ConversationMode)
      : 'push-to-talk'
  const topicId = typeof value.topicId === 'string' ? value.topicId : null
  const starter = findConversationStarter(topicId)

  if (topicId && !starter) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Unknown conversation topic'), { status: 400 })
  }

  const session = await createConversationSession({
    studentId: auth.user.uid,
    level,
    mode,
    topicId: starter?.id ?? null,
    topicLabel: starter?.label ?? null,
  })

  return NextResponse.json({ data: { session } }, { status: 201, headers: { 'cache-control': 'no-store' } })
}
