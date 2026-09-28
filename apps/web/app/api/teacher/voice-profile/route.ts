import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { HttpVoiceProvider, VoiceProviderError } from '@/lib/ai/voice-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { getTtsEnv } from '@/lib/config/env'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import {
  deleteTeacherVoiceProfile,
  failTeacherVoiceEnrollment,
  getTeacherVoiceProfile,
  getTeacherVoiceProfileState,
  saveTeacherVoiceProfile,
  startTeacherVoiceEnrollment,
  updateTeacherVoiceProfileStatus,
} from '@/lib/voice-profile'

const MAX_REFERENCE_AUDIO_BYTES = 15 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm'])

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_REFERENCE_AUDIO_BYTES && ALLOWED_AUDIO_TYPES.has(value.type)
}

function safeAudioFilename(name: string) {
  const safe = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180)
  return safe || 'voice-reference-audio'
}

function providerOrUnavailable() {
  let config: ReturnType<typeof getTtsEnv>
  try {
    config = getTtsEnv()
  } catch {
    return null
  }
  if (!config.baseUrl || config.route !== 'local') return null
  return new HttpVoiceProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    modelId: config.modelId,
    enrollmentPath: config.enrollmentPath,
    statusPath: config.statusPath,
    deletePath: config.deletePath,
  })
}

function providerFailure(error: VoiceProviderError) {
  const status = error.retryable ? 503 : 502
  return NextResponse.json(
    apiError('EXTERNAL_SERVICE_ERROR', error.message, {
      code: error.code,
      retryable: error.retryable,
      status: 'failed',
    }),
    { status },
  )
}

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const profile = await getTeacherVoiceProfile(auth.user.uid)
  if (!profile) return NextResponse.json({ data: { status: 'not_configured' } })
  if (profile.status !== 'processing' || !profile.providerVoiceId) return NextResponse.json({ data: profile })

  const provider = providerOrUnavailable()
  if (!provider) {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice status polling is not configured', {
      code: 'VOICE_PROVIDER_UNAVAILABLE',
      retryable: true,
    }), { status: 503 })
  }

  try {
    const result = await provider.getStatus(profile.providerVoiceId)
    const updated = await updateTeacherVoiceProfileStatus(auth.user.uid, result.status, result.errorCode)
    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      if (!error.retryable) {
        const failed = await updateTeacherVoiceProfileStatus(auth.user.uid, 'failed', error.code)
        return NextResponse.json({ data: failed }, { status: 200 })
      }
      return providerFailure(error)
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const form = await request.formData()
  const consent = form.get('consent')
  const referenceText = form.get('referenceText')
  const audio = form.get('audio')
  if (consent !== 'true' || typeof referenceText !== 'string' || referenceText.trim().length < 3 || referenceText.trim().length > 2_000 || !isAudioFile(audio)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Consent, transcript, and a valid audio sample are required'), { status: 400 })
  }

  const audioBytes = new Uint8Array(await audio.arrayBuffer())
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A stable Idempotency-Key is required for voice enrollment'), { status: 400 })
  }
  const requestHash = createHash('sha256')
    .update(auth.user.uid)
    .update('\0')
    .update(referenceText.trim())
    .update('\0')
    .update(audioBytes)
    .digest('hex')

  const provider = providerOrUnavailable()
  if (!provider) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })

  const currentState = await getTeacherVoiceProfileState(auth.user.uid)
  const current = currentState.profile
  if (currentState.idempotencyKey === idempotencyKey && currentState.requestHash !== requestHash) {
    return NextResponse.json(apiError('CONFLICT', 'Idempotency-Key was reused with a different voice sample', { code: 'IDEMPOTENCY_KEY_REUSED' }), { status: 409 })
  }
  if (current && currentState.idempotencyKey === idempotencyKey && current.status !== 'failed') {
    return NextResponse.json({ data: current }, { status: current.status === 'processing' ? 202 : 200 })
  }
  if (current?.status === 'ready') {
    return NextResponse.json(apiError('CONFLICT', 'Delete the active voice profile before enrolling a replacement', { code: 'VOICE_PROFILE_DELETE_REQUIRED' }), { status: 409 })
  }
  if (current?.status === 'processing') {
    return NextResponse.json(apiError('CONFLICT', 'A voice enrollment is already processing', { code: 'VOICE_PROFILE_PROCESSING', retryable: true }), { status: 409 })
  }
  try {
    await consumeApiRateLimit({ scope: 'voice-enrollment', subject: auth.user.uid, limit: 3, windowMs: 60 * 60 * 1_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }
  if (current?.providerVoiceId) {
    try {
      await provider.delete(current.providerVoiceId)
    } catch (error) {
      if (error instanceof VoiceProviderError) return providerFailure(error)
      throw error
    }
  }

  let started
  try {
    started = await startTeacherVoiceEnrollment(auth.user.uid, idempotencyKey, requestHash, new Date().toISOString())
  } catch (error) {
    if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_REUSED') {
      return NextResponse.json(apiError('CONFLICT', 'Idempotency-Key was reused with a different voice sample', { code: error.message }), { status: 409 })
    }
    if (error instanceof Error && ['VOICE_PROFILE_DELETE_REQUIRED', 'VOICE_PROFILE_PROCESSING'].includes(error.message)) {
      return NextResponse.json(apiError('CONFLICT', 'A voice profile must finish or be deleted before re-enrollment', { code: error.message }), { status: 409 })
    }
    throw error
  }
  if (!started.started) return NextResponse.json({ data: started.profile }, { status: 202 })

  try {
    const enrollment = await provider.enroll({
      audio: audioBytes,
      mimeType: audio.type,
      filename: safeAudioFilename(audio.name),
      referenceText: referenceText.trim(),
      idempotencyKey,
    })
    let profile
    try {
      profile = await saveTeacherVoiceProfile(auth.user.uid, enrollment)
    } catch {
      let cleanupPending = false
      if (enrollment.providerVoiceId) {
        try {
          await provider.delete(enrollment.providerVoiceId)
        } catch {
          cleanupPending = true
        }
      }
      await updateTeacherVoiceProfileStatus(
        auth.user.uid,
        'failed',
        cleanupPending ? 'VOICE_PROFILE_CLEANUP_PENDING' : 'VOICE_PROFILE_PERSISTENCE_FAILED',
        cleanupPending ? enrollment.providerVoiceId : null,
      ).catch(() => {})
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Voice profile could not be persisted after provider enrollment', {
        code: cleanupPending ? 'VOICE_PROFILE_CLEANUP_PENDING' : 'VOICE_PROFILE_PERSISTENCE_FAILED',
        retryable: true,
      }), { status: 503 })
    }
    if (enrollment.status === 'failed') {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Voice enrollment failed at the provider', {
        code: enrollment.errorCode ?? 'VOICE_ENROLLMENT_FAILED',
        retryable: false,
        status: 'failed',
      }), { status: 502 })
    }
    return NextResponse.json({ data: profile }, { status: 201 })
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      await failTeacherVoiceEnrollment(auth.user.uid, error.code)
      return providerFailure(error)
    }
    throw error
  }
}

export async function DELETE() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const profile = await getTeacherVoiceProfile(auth.user.uid)
  if (!profile) return NextResponse.json({ data: { status: 'not_configured' } })
  if (profile.providerVoiceId) {
    const provider = providerOrUnavailable()
    if (!provider) return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'OmniVoice is not configured'), { status: 503 })
    try {
      await provider.delete(profile.providerVoiceId)
    } catch (error) {
      if (error instanceof VoiceProviderError) return providerFailure(error)
      throw error
    }
  }
  await deleteTeacherVoiceProfile(auth.user.uid)
  return NextResponse.json({ data: { status: 'not_configured' } })
}
