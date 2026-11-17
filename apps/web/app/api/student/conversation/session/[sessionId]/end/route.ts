import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { normalizeConversationSummary, type ConversationSummary } from '@tuturai/domain'
import { ConversationProviderError, HttpConversationProvider } from '@/lib/ai/conversation-provider'
import { buildConversationSummaryPrompt } from '@/lib/ai/conversation-prompt'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getAiEnv } from '@/lib/config/env'
import {
  endConversationSession,
  getConversationSession,
  loadConversationTurns,
} from '@/lib/conversation/store'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(_request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
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

  if (session.summary) {
    return NextResponse.json({ data: { summary: session.summary } }, { headers: { 'cache-control': 'no-store' } })
  }

  const turns = await loadConversationTurns(auth.user.uid, sessionId)
  const studentTurns = turns.filter((turn) => turn.speaker === 'student')
  const durationMinutes = Math.max(0, Math.round((Date.now() - session.startedAt) / 60_000))

  // A two-turn session cannot support an honest summary, so it is reported as
  // insufficient instead of spending a model call to invent one.
  if (studentTurns.length < 2) {
    const summary: ConversationSummary = {
      overview: {
        durationMinutes,
        turns: studentTurns.length,
        topics: session.topicLabel ? [session.topicLabel] : [],
        summary:
          'Percakapan ini masih terlalu singkat untuk membuat ringkasan yang representatif. Coba bicara beberapa turn lagi agar TuturAI bisa melihat pola kesalahanmu.',
      },
      grammar: [],
      vocabulary: [],
      naturalExpressions: [],
      recommendations: ['Lanjutkan percakapan minimal tiga turn agar ringkasan belajar bisa dibuat.'],
      sufficientEvidence: false,
    }
    await endConversationSession({ studentId: auth.user.uid, sessionId, summary })
    return NextResponse.json({ data: { summary } }, { headers: { 'cache-control': 'no-store' } })
  }

  try {
    await consumeApiRateLimit({ scope: 'student-conversation-summary', subject: auth.user.uid, limit: 6, windowMs: 60_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }

  let config: ReturnType<typeof getAiEnv>['ai']
  try {
    config = getAiEnv().ai
  } catch {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Tutor is not configured'), { status: 503 })
  }
  if (!config.llm.baseUrl) {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Tutor is not configured'), { status: 503 })
  }

  try {
    const provider = new HttpConversationProvider({
      baseUrl: config.llm.baseUrl,
      modelId: config.llm.modelId,
      apiKey: config.llm.apiKey,
      timeoutMs: 45_000,
    })
    const raw = await provider.complete([
      {
        role: 'system',
        content: buildConversationSummaryPrompt({
          level: session.level,
          topicLabel: session.topicLabel,
          durationMinutes,
          turns: turns.map((turn) => ({ speaker: turn.speaker, transcript: turn.transcript })),
        }),
      },
      { role: 'user', content: 'Buat ringkasan belajar sekarang.' },
    ])

    const normalized = normalizeConversationSummary(raw)
    if (!normalized.success) {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Ringkasan tidak dapat dibuat dari respons tutor.', {
          code: 'INVALID_SUMMARY',
          retryable: true,
        }),
        { status: 502 },
      )
    }

    await endConversationSession({ studentId: auth.user.uid, sessionId, summary: normalized.data })
    return NextResponse.json({ data: { summary: normalized.data } }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    if (error instanceof ConversationProviderError) {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable }),
        { status: error.code === 'RATE_LIMITED' ? 429 : error.retryable ? 503 : 502 },
      )
    }
    throw error
  }
}
