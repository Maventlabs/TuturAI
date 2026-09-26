import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpVoiceProvider, VoiceProviderError } from '@/lib/ai/voice-provider'
import { getAiEnv } from '@/lib/config/env'
import { getStudentClassroomVoiceProfile } from '@/lib/voice-profile'
import { readJsonBody } from '@/lib/api/request'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const rawBody = await readJsonBody(request)
  const body = rawBody && typeof rawBody === 'object' ? rawBody as { text?: unknown } : null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 500) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Voice text must be 1-500 characters'), { status: 400 })
  }

  const { classroomId } = await context.params
  try {
    const profile = await getStudentClassroomVoiceProfile(auth.user.uid, classroomId)
    if (!profile || profile.status === 'processing') {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Teacher voice is not ready', { status: profile?.status ?? 'not_configured' }), { status: 409 })
    }
    if (profile.status === 'failed') {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Teacher voice is unavailable', { status: profile.status, code: profile.errorCode }), { status: 503 })
    }

    let config: ReturnType<typeof getAiEnv>['ai']['tts']
    try {
      config = getAiEnv().ai.tts
    } catch {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })
    }
    if (config.route !== 'local' || !config.baseUrl) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })
    }

    const audio = await new HttpVoiceProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      modelId: config.modelId,
      synthesisPath: config.synthesisPath,
    }).synthesize({ providerVoiceId: profile.providerVoiceId, text })

    return new NextResponse(audio.audio, {
      status: 200,
      headers: { 'Content-Type': audio.contentType, 'Cache-Control': 'no-store' },
    })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    if (cause instanceof VoiceProviderError) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', cause.message, { code: cause.code, retryable: cause.retryable }), { status: cause.retryable ? 503 : 502 })
    }
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Tutor audio could not be generated'), { status: 500 })
  }
}
