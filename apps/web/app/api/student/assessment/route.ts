import { NextRequest, NextResponse } from 'next/server'
import { type Assessment, type AssessmentMode } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { AssessmentProviderError, HttpAssessmentProvider } from '@/lib/ai/assessment-provider'
import { processAssessment } from '@/lib/ai/assessment-processing'
import {
  TranscriptValidationError,
  metricsFromServerStt,
  normalizeClientTranscript,
  type DerivedTranscriptMetrics,
} from '@/lib/ai/client-transcript'
import { HttpSttProvider, SttProviderError } from '@/lib/ai/stt-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { getAiEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import { saveAssessment } from '@/lib/scoring-persistence'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_AUDIO_BYTES && value.type.startsWith('audio/')
}

export async function GET(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(sessionId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid sessionId is required', { requestId }), { status: 400 })
  }

  try {
    const snapshot = await getAdminDb().collection('assessments').doc(`${auth.user.uid}_${sessionId}`).get()
    const assessment = snapshot.data()
    if (!snapshot.exists || assessment?.studentId !== auth.user.uid || assessment?.sessionId !== sessionId) {
      return NextResponse.json(apiError('NOT_FOUND', 'Assessment result was not found', { requestId }), { status: 404 })
    }
    return NextResponse.json({ data: assessment }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch {
    logApiFailure({ requestId, route: '/api/student/assessment', status: 500, errorCode: 'ASSESSMENT_READBACK_FAILED', provider: 'firestore', durationMs: 0 })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Assessment result could not be loaded', { code: 'ASSESSMENT_READBACK_FAILED', retryable: true, requestId }), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)

  const form = await request.formData()
  const sessionId = form.get('sessionId')
  const modeValue = form.get('mode')
  const expectedText = form.get('expectedText')
  const questionId = form.get('questionId')
  const audio = form.get('audio')
  const transcriptValue = form.get('transcript')
  const durationValue = form.get('spokenDurationMs')
  const sourceValue = form.get('transcriptSource')
  const mode = ['speaking', 'pronunciation', 'conversation'].includes(String(modeValue)) ? modeValue as AssessmentMode : 'speaking'

  const hasClientTranscript = typeof transcriptValue === 'string' && transcriptValue.trim().length > 0
  const hasAudio = isAudioFile(audio)
  const audioFile: File | null = hasAudio ? (audio as File) : null

  if (
    typeof sessionId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(sessionId) ||
    (!hasAudio && !hasClientTranscript) ||
    (expectedText !== null && typeof expectedText !== 'string') ||
    (questionId !== null && (typeof questionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(questionId)))
  ) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'A valid sessionId with either an audio file or a transcript is required', { requestId }),
      { status: 400 },
    )
  }

  try {
    try {
      await consumeApiRateLimit({ scope: 'student-assessment', subject: auth.user.uid, limit: 12, windowMs: 60_000 })
    } catch (error) {
      const limited = rateLimitResponse(error)
      if (limited) return limited
      throw error
    }

    // Resolve the transcript BEFORE loading provider config. The browser path
    // must not require STT to be configured; only the audio path does.
    let metrics: DerivedTranscriptMetrics | null = null
    let requestAudio: { audio: Uint8Array; mimeType: string; filename: string } | null = null

    if (audioFile) {
      // Server-side transcription is the only path whose audio can be trusted,
      // so it always wins when the client supplies both an audio file and a
      // transcript.
      requestAudio = {
        audio: new Uint8Array(await audioFile.arrayBuffer()),
        mimeType: audioFile.type,
        filename: audioFile.name,
      }
    } else if (hasClientTranscript) {
      const reportedDuration = typeof durationValue === 'string' ? Number(durationValue) : Number.NaN
      try {
        metrics = normalizeClientTranscript({
          transcript: transcriptValue as string,
          reportedDurationMs: reportedDuration,
          source: 'browser_speech_api',
        })
      } catch (error) {
        if (error instanceof TranscriptValidationError) {
          return NextResponse.json(
            apiError('VALIDATION_ERROR', error.message, { code: 'INVALID_TRANSCRIPT', requestId }),
            { status: 400 },
          )
        }
        throw error
      }
    }

    let config: ReturnType<typeof getAiEnv>['ai']
    try {
      config = getAiEnv().ai
    } catch {
      // A browser transcript still needs the LLM for grammar/vocabulary, so an
      // unconfigured AI environment fails closed in both modes.
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Speech assessment providers are not configured'), { status: 503 })
    }

    if (requestAudio) {
      if (!config.stt.baseUrl) {
        return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Speech assessment providers are not configured'), { status: 503 })
      }
      const transcription = await new HttpSttProvider({
        baseUrl: config.stt.baseUrl,
        // whisper.cpp's server serves a single loaded model and ignores this
        // field, so a default keeps the provider's non-empty contract.
        modelId: config.stt.modelId ?? 'whisper',
        apiKey: config.stt.apiKey,
      }).transcribe(requestAudio)
      metrics = metricsFromServerStt(transcription.text, 0)
    }

    if (!config.llm.baseUrl) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Speech assessment providers are not configured'), { status: 503 })
    }
    if (!metrics) {
      // Unreachable: exactly one of the two branches above always sets metrics.
      return NextResponse.json(apiError('INTERNAL_ERROR', 'Assessment input could not be resolved', { requestId }), { status: 500 })
    }

    const provider = new HttpAssessmentProvider({
      baseUrl: config.llm.baseUrl,
      modelId: config.llm.modelId,
      apiKey: config.llm.apiKey,
    })
    const assessment = await processAssessment({
      provider,
      save: saveAssessment,
      studentId: auth.user.uid,
      sessionId,
      questionId: typeof questionId === 'string' ? questionId : undefined,
      mode,
      request: {
        audio: requestAudio?.audio ?? new Uint8Array(0),
        mimeType: requestAudio?.mimeType ?? 'audio/webm',
        filename: requestAudio?.filename,
        mode,
        expectedText: typeof expectedText === 'string' ? expectedText.trim() : undefined,
        transcript: metrics.transcript,
      },
      audioEvidence: {
        fluency: {
          wordCount: metrics.wordCount,
          spokenDurationMs: metrics.spokenDurationMs,
          totalPauseDurationMs: 0,
          totalRecordingDurationMs: metrics.totalRecordingDurationMs,
        },
      },
      clientTranscript: metrics,
    })
    return NextResponse.json({ data: assessment })
  } catch (error) {
    if (error instanceof AssessmentProviderError || error instanceof SttProviderError) {
      const status = error.code === 'CANCELLED' ? 499 : error.retryable ? 503 : 502
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable, requestId }), { status })
    }
    throw error
  }
}
