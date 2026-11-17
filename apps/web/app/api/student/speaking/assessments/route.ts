import { NextRequest, NextResponse } from 'next/server'
import {
  getSpeakingScenario,
  isSpeakingPracticeMode,
  isSpeakingSessionType,
  type PronunciationAlignmentEvidence,
} from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { HttpSpeakingAnalysisProvider, SpeakingAnalysisError } from '@/lib/ai/speaking-analysis-provider'
import { HttpPronunciationProvider, PronunciationProviderError } from '@/lib/ai/pronunciation-provider'
import { HttpSttProvider, SttProviderError } from '@/lib/ai/stt-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import { getAiEnv, getPronunciationEnv } from '@/lib/config/env'
import { saveAssessment } from '@/lib/scoring-persistence'
import { runSpeakingAssessment, type SpeakingPipelineDeps } from '@/lib/speaking/assessment-pipeline'
import {
  getSpeakingAttempt,
  listSpeakingAttempts,
  saveSpeakingAttempt,
  summarizeSpeakingHistory,
  toHistoryEntry,
} from '@/lib/speaking/attempts'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const WAV_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'])

function isWavFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_AUDIO_BYTES && WAV_TYPES.has(value.type)
}

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'speaking-answer.wav'
}

export async function GET(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)

  try {
    const attempts = await listSpeakingAttempts(auth.user.uid)
    return NextResponse.json(
      {
        data: {
          attempts: attempts.map(toHistoryEntry),
          progress: summarizeSpeakingHistory(attempts),
        },
      },
      { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
    )
  } catch {
    logApiFailure({
      requestId,
      route: '/api/student/speaking/assessments',
      status: 500,
      errorCode: 'SPEAKING_HISTORY_FAILED',
      provider: 'firestore',
      durationMs: 0,
    })
    return NextResponse.json(
      apiError('INTERNAL_ERROR', 'Speaking history could not be loaded', {
        code: 'SPEAKING_HISTORY_FAILED',
        retryable: true,
        requestId,
      }),
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)
  const startedAt = performance.now()

  const form = await request.formData()
  const sessionId = form.get('sessionId')
  const scenarioId = form.get('scenarioId')
  const practiceMode = form.get('practiceMode')
  const sessionType = form.get('sessionType')
  const audio = form.get('audio')

  const scenario = typeof scenarioId === 'string' ? getSpeakingScenario(scenarioId) : null
  if (
    typeof sessionId !== 'string'
    || !/^[A-Za-z0-9_-]{1,120}$/.test(sessionId)
    || !scenario
    || !isSpeakingPracticeMode(practiceMode)
    || !isSpeakingSessionType(sessionType)
    || !isWavFile(audio)
  ) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'A valid session, scenario, practice mode, session type, and WAV recording are required', {
        requestId,
      }),
      { status: 400 },
    )
  }

  try {
    await consumeApiRateLimit({ scope: 'student-speaking', subject: auth.user.uid, limit: 10, windowMs: 60_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }

  // Idempotency: a retried upload for the same session returns the stored attempt
  // instead of running the providers (and awarding XP) twice.
  const existing = await getSpeakingAttempt(auth.user.uid, sessionId)
  if (existing) {
    return NextResponse.json({ data: existing }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  }

  let config: ReturnType<typeof getAiEnv>['ai']
  try {
    config = getAiEnv().ai
  } catch {
    return NextResponse.json(
      apiError('EXTERNAL_SERVICE_ERROR', 'Speech assessment providers are not configured', {
        code: 'PROVIDERS_NOT_CONFIGURED',
        retryable: false,
        requestId,
      }),
      { status: 503 },
    )
  }
  if (!config.stt.baseUrl || !config.llm.baseUrl) {
    return NextResponse.json(
      apiError('EXTERNAL_SERVICE_ERROR', 'Speech assessment providers are not configured', {
        code: 'PROVIDERS_NOT_CONFIGURED',
        retryable: false,
        requestId,
      }),
      { status: 503 },
    )
  }

  const audioBytes = new Uint8Array(await audio.arrayBuffer())
  const audioInput = { bytes: audioBytes, mimeType: audio.type, filename: safeFilename(audio.name) }

  const pronunciationEnv = getPronunciationEnv()
  const pronunciationReady = Boolean(pronunciationEnv.baseUrl && pronunciationEnv.modelId && pronunciationEnv.path)

  const deps: SpeakingPipelineDeps = {
    transcribe: async (input) => {
      const result = await new HttpSttProvider({
        baseUrl: config.stt.baseUrl as string,
        path: config.stt.path,
        modelId: config.stt.modelId ?? 'whisper',
        apiKey: config.stt.apiKey,
      }).transcribe({
        audio: input.bytes,
        mimeType: input.mimeType,
        filename: input.filename,
        language: 'en',
        signal: request.signal,
      })
      return { text: result.text, confidence: result.confidence, modelId: config.stt.modelId ?? null }
    },
    analyzeLanguage: async (analysisRequest) => {
      const provider = new HttpSpeakingAnalysisProvider({
        baseUrl: config.llm.baseUrl as string,
        modelId: config.llm.modelId,
        apiKey: config.llm.apiKey,
      })
      return provider.analyze(analysisRequest)
    },
    ...(pronunciationReady
      ? {
          alignPronunciation: async (input: { bytes: Uint8Array; mimeType: string; filename: string; targetText: string }) => {
            const provider = new HttpPronunciationProvider({
              baseUrl: pronunciationEnv.baseUrl as string,
              path: pronunciationEnv.path as string,
              modelId: pronunciationEnv.modelId as string,
              apiKey: pronunciationEnv.apiKey,
              timeoutMs: pronunciationEnv.timeoutMs,
            })
            const result = await provider.align({
              audio: input.bytes,
              mimeType: input.mimeType,
              filename: input.filename,
              expectedText: input.targetText,
              language: 'en',
              idempotencyKey: sessionId,
              signal: request.signal,
            })
            const evidence: PronunciationAlignmentEvidence = {
              words: result.words.map((word) => ({
                phonemes: word.phonemes.map((phoneme) => ({
                  expected: phoneme.expected,
                  actual: phoneme.actual,
                  confidence: phoneme.confidence,
                })),
              })),
            }
            return { evidence, modelId: pronunciationEnv.modelId ?? null }
          },
        }
      : {}),
    saveAttempt: saveSpeakingAttempt,
    saveAssessment,
  }

  try {
    const attempt = await runSpeakingAssessment(
      {
        studentId: auth.user.uid,
        sessionId,
        scenario,
        practiceMode,
        sessionType,
        audio: audioInput,
        signal: request.signal,
      },
      deps,
    )

    if (attempt.status === 'FAILED') {
      const status = attempt.failure?.retryable === false ? 502 : 503
      logApiFailure({
        requestId,
        route: '/api/student/speaking/assessments',
        status,
        errorCode: attempt.failure?.code ?? 'SPEAKING_ASSESSMENT_FAILED',
        provider: 'speaking-pipeline',
        durationMs: performance.now() - startedAt,
      })
      return NextResponse.json(
        {
          ...apiError('EXTERNAL_SERVICE_ERROR', attempt.failure?.message ?? 'Speaking assessment failed', {
            code: attempt.failure?.code ?? 'SPEAKING_ASSESSMENT_FAILED',
            retryable: attempt.failure?.retryable ?? true,
            requestId,
          }),
          data: attempt,
        },
        { status, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
      )
    }

    return NextResponse.json(
      { data: attempt },
      { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
    )
  } catch (error) {
    if (
      error instanceof SttProviderError
      || error instanceof SpeakingAnalysisError
      || error instanceof PronunciationProviderError
    ) {
      const status = error.code === 'CANCELLED' ? 499 : error.retryable ? 503 : 502
      logApiFailure({
        requestId,
        route: '/api/student/speaking/assessments',
        status,
        errorCode: error.code,
        provider: 'speaking-pipeline',
        durationMs: performance.now() - startedAt,
      })
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable, requestId }),
        { status },
      )
    }
    logApiFailure({
      requestId,
      route: '/api/student/speaking/assessments',
      status: 500,
      errorCode: 'SPEAKING_ASSESSMENT_FAILED',
      provider: 'speaking-pipeline',
      durationMs: performance.now() - startedAt,
    })
    return NextResponse.json(
      apiError('INTERNAL_ERROR', 'Speaking assessment could not be completed', {
        code: 'SPEAKING_ASSESSMENT_FAILED',
        retryable: true,
        requestId,
      }),
      { status: 500 },
    )
  }
}
