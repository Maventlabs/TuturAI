import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { HttpPronunciationProvider, PronunciationProviderError } from '@/lib/ai/pronunciation-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getPronunciationEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import {
  getStudentPronunciationAttemptState,
  getStudentPronunciationResult,
  recordPronunciationFailure,
  saveStudentPronunciationResult,
} from '@/lib/pronunciation-attempts'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const AUDIO_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm'])

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_AUDIO_BYTES && AUDIO_TYPES.has(value.type)
}

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'pronunciation-audio'
}

function providerErrorResponse(error: PronunciationProviderError, requestId: string, startedAt: number) {
  const status = error.code === 'CANCELLED' ? 499 : error.retryable ? 503 : 502
  logApiFailure({
    requestId,
    route: '/api/student/pronunciation',
    status,
    errorCode: error.code,
    provider: 'pronunciation',
    providerErrorCode: error.code,
    durationMs: performance.now() - startedAt,
  })
  return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', error.message, {
    code: error.code,
    retryable: error.retryable,
    requestId,
  }), { status, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
}

export async function GET(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const attemptId = request.nextUrl.searchParams.get('attemptId')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(attemptId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid pronunciation attempt ID is required'), { status: 400 })
  }
  const result = await getStudentPronunciationResult(auth.user.uid, attemptId)
  if (!result) return NextResponse.json(apiError('NOT_FOUND', 'Pronunciation result was not found'), { status: 404 })
  const requestId = getRequestId(request)
  return NextResponse.json({ data: result }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now()
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A stable Idempotency-Key is required'), { status: 400 })
  }

  const form = await request.formData()
  const questionId = form.get('questionId')
  const audio = form.get('audio')
  if (typeof questionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(questionId) || !isAudioFile(audio)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid pronunciation question and audio file are required'), { status: 400 })
  }
  const audioBytes = new Uint8Array(await audio.arrayBuffer())
  const requestHash = createHash('sha256')
    .update(auth.user.uid).update('\0')
    .update(questionId).update('\0')
    .update(audio.type).update('\0')
    .update(audioBytes)
    .digest('hex')

  const existing = await getStudentPronunciationAttemptState(auth.user.uid, idempotencyKey)
  if (existing.requestHash && existing.requestHash !== requestHash) {
    return NextResponse.json(apiError('CONFLICT', 'Idempotency-Key was reused with a different audio payload', { code: 'IDEMPOTENCY_KEY_REUSED', requestId }), { status: 409 })
  }
  if (existing.result) return NextResponse.json({ data: existing.result }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })

  const question = await getAdminDb().collection('questionBank').doc(questionId).get()
  const questionData = question.data()
  const expectedText = typeof questionData?.word === 'string' ? questionData.word.trim() : ''
  if (!question.exists || questionData?.status !== 'published' || questionData?.contentType !== 'pronunciation' || !expectedText) {
    return NextResponse.json(apiError('NOT_FOUND', 'Pronunciation question was not found'), { status: 404 })
  }

  let providerConfig: ReturnType<typeof getPronunciationEnv>
  try {
    providerConfig = getPronunciationEnv()
  } catch {
    providerConfig = { route: 'v1', baseUrl: undefined, apiKey: undefined, modelId: undefined, path: undefined, timeoutMs: 30_000 }
  }
  if (!providerConfig.baseUrl || !providerConfig.modelId || !providerConfig.path) {
    await recordPronunciationFailure({
      studentId: auth.user.uid,
      questionId,
      idempotencyKey,
      requestHash,
      errorCode: 'PRONUNCIATION_PROVIDER_UNAVAILABLE',
      retryable: true,
    })
    logApiFailure({
      requestId,
      route: '/api/student/pronunciation',
      status: 503,
      errorCode: 'PRONUNCIATION_PROVIDER_UNAVAILABLE',
      provider: 'pronunciation',
      durationMs: performance.now() - startedAt,
    })
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Phoneme scoring provider is not configured', {
      code: 'PRONUNCIATION_PROVIDER_UNAVAILABLE',
      retryable: true,
      requestId,
    }), { status: 503, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  }

  try {
    await consumeApiRateLimit({ scope: 'student-pronunciation', subject: auth.user.uid, limit: 10, windowMs: 60_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }

  try {
    const provider = new HttpPronunciationProvider({
      baseUrl: providerConfig.baseUrl,
      path: providerConfig.path,
      modelId: providerConfig.modelId,
      apiKey: providerConfig.apiKey,
      timeoutMs: providerConfig.timeoutMs,
    })
    const result = await provider.align({
      audio: audioBytes,
      mimeType: audio.type,
      filename: safeFilename(audio.name),
      expectedText,
      idempotencyKey,
      signal: request.signal,
    })
    const saved = await saveStudentPronunciationResult({
      studentId: auth.user.uid,
      questionId,
      idempotencyKey,
      requestHash,
      modelId: providerConfig.modelId,
      result,
    })
    return NextResponse.json({ data: saved }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (error) {
    if (error instanceof PronunciationProviderError) {
      const recorded = await recordPronunciationFailure({
        studentId: auth.user.uid,
        questionId,
        idempotencyKey,
        requestHash,
        errorCode: error.code,
        retryable: error.retryable,
      })
      if (recorded.status === 'completed') return NextResponse.json({ data: recorded.result }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
      return providerErrorResponse(error, requestId, startedAt)
    }
    if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_REUSED') {
      return NextResponse.json(apiError('CONFLICT', 'Idempotency-Key was reused with a different audio payload', { code: error.message, requestId }), { status: 409 })
    }
    if (error instanceof Error && error.message === 'QUESTION_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Pronunciation question was not found'), { status: 404 })
    }
    logApiFailure({
      requestId,
      route: '/api/student/pronunciation',
      status: 500,
      errorCode: 'PRONUNCIATION_INTERNAL_ERROR',
      provider: 'firebase-admin',
      durationMs: performance.now() - startedAt,
    })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Pronunciation attempt could not be completed', {
      code: 'PRONUNCIATION_INTERNAL_ERROR',
      retryable: true,
      requestId,
    }), { status: 500, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  }
}
