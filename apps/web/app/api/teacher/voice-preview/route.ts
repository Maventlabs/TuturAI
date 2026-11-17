import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { VoiceProviderError } from '@/lib/ai/voice-provider'
import { synthesizeWithFailover } from '@/lib/ai/tts-synthesis'
import { requireRole } from '@/lib/api/auth-guard'
import { getTtsEnv } from '@/lib/config/env'
import { getTeacherVoiceProfile } from '@/lib/voice-profile'

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 500) return NextResponse.json(apiError('VALIDATION_ERROR', 'Preview text must be 1-500 characters'), { status: 400 })
  const profile = await getTeacherVoiceProfile(auth.user.uid)
  if (!profile || profile.status !== 'ready' || !profile.providerVoiceId) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Voice profile is not ready'), { status: 409 })
  let config: ReturnType<typeof getTtsEnv>
  try {
    config = getTtsEnv()
  } catch {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })
  }
  const baseUrl = config.baseUrl
  if (config.route !== 'local' || !baseUrl) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })
  try {
    const audio = await synthesizeWithFailover({ ...config, baseUrl }, { providerVoiceId: profile.providerVoiceId, text })
    return new NextResponse(audio.audio, { status: 200, headers: { 'Content-Type': audio.contentType, 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof VoiceProviderError) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable }), { status: error.retryable ? 503 : 502 })
    throw error
  }
}
