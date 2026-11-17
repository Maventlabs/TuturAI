import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { sanitizeSpokenText } from '@tuturai/domain'
import { synthesizeWithFailover } from '@/lib/ai/tts-synthesis'
import { VoiceProviderError } from '@/lib/ai/voice-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getTtsEnv } from '@/lib/config/env'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_SPEECH_CHARS = 600

/**
 * Speaks one tutor line. Kept separate from the turn route so a failed voice
 * generation can be retried without repeating the conversation turn.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request)
  const value = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const text = typeof value.text === 'string' ? sanitizeSpokenText(value.text) : ''

  if (!text) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Text is required'), { status: 400 })
  }
  if (text.length > MAX_SPEECH_CHARS) {
    return NextResponse.json(apiError('VALIDATION_ERROR', `Text must be at most ${MAX_SPEECH_CHARS} characters`), { status: 400 })
  }

  try {
    await consumeApiRateLimit({ scope: 'student-conversation-speech', subject: auth.user.uid, limit: 30, windowMs: 60_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }

  let config: ReturnType<typeof getTtsEnv>
  try {
    config = getTtsEnv()
  } catch {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Tutor voice is not configured'), { status: 503 })
  }
  if (!config.baseUrl) {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Tutor voice is not configured'), { status: 503 })
  }

  try {
    const audio = await synthesizeWithFailover(
      { ...config, baseUrl: config.baseUrl },
      { providerVoiceId: config.voiceName, text },
    )
    return new NextResponse(audio.audio, {
      status: 200,
      headers: {
        'Content-Type': audio.contentType,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Suara tutor gagal dibuat. Coba putar ulang.', {
          code: error.code,
          retryable: error.retryable,
        }),
        { status: error.retryable ? 503 : 502 },
      )
    }
    throw error
  }
}
