import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { HttpVoiceProvider, VoiceProviderError } from '@/lib/ai/voice-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { getAiEnv } from '@/lib/config/env'
import { deleteTeacherVoiceProfile, getTeacherVoiceProfile, saveTeacherVoiceProfile } from '@/lib/voice-profile'

const MAX_REFERENCE_AUDIO_BYTES = 15 * 1024 * 1024

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_REFERENCE_AUDIO_BYTES && value.type.startsWith('audio/')
}

function providerOrUnavailable() {
  const config = getAiEnv().ai.tts
  if (!config.baseUrl || config.route !== 'local') return null
  return new HttpVoiceProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    modelId: config.modelId,
    enrollmentPath: config.enrollmentPath,
    deletePath: config.deletePath,
  })
}

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  return NextResponse.json({ data: (await getTeacherVoiceProfile(auth.user.uid)) ?? { status: 'not_configured' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const form = await request.formData()
  const consent = form.get('consent')
  const referenceText = form.get('referenceText')
  const audio = form.get('audio')
  if (consent !== 'true' || typeof referenceText !== 'string' || referenceText.trim().length < 3 || !isAudioFile(audio)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Consent, transcript, and a valid audio sample are required'), { status: 400 })
  }

  const provider = providerOrUnavailable()
  if (!provider) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })

  try {
    const enrollment = await provider.enroll({
      audio: new Uint8Array(await audio.arrayBuffer()),
      mimeType: audio.type,
      filename: audio.name,
      referenceText: referenceText.trim(),
    })
    const profile = await saveTeacherVoiceProfile(auth.user.uid, enrollment, new Date().toISOString())
    return NextResponse.json({ data: profile }, { status: 201 })
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable }), { status: error.retryable ? 503 : 502 })
    }
    throw error
  }
}

export async function DELETE() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const profile = await getTeacherVoiceProfile(auth.user.uid)
  if (!profile) return NextResponse.json({ data: { status: 'not_configured' } })
  const provider = providerOrUnavailable()
  if (!provider) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })

  try {
    await provider.delete(profile.providerVoiceId)
    await deleteTeacherVoiceProfile(auth.user.uid)
    return NextResponse.json({ data: { status: 'not_configured' } })
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable }), { status: error.retryable ? 503 : 502 })
    }
    throw error
  }
}
