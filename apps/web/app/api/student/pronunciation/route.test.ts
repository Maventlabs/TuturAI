import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpPronunciationProvider, PronunciationProviderError } from '@/lib/ai/pronunciation-provider'
import { getPronunciationEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getStudentPronunciationAttemptState, getStudentPronunciationResult, recordPronunciationFailure, saveStudentPronunciationResult } from '@/lib/pronunciation-attempts'

const { requireRoleMock, getAdminDbMock, rateLimitMock, rateLimitResponseMock, getPronunciationEnvMock, providerMock, getAttemptStateMock, getResultMock, recordFailureMock, saveResultMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  getAdminDbMock: vi.fn(),
  rateLimitMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
  getPronunciationEnvMock: vi.fn(),
  providerMock: vi.fn(),
  getAttemptStateMock: vi.fn(),
  getResultMock: vi.fn(),
  recordFailureMock: vi.fn(),
  saveResultMock: vi.fn(),
}))

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: requireRoleMock }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: getAdminDbMock }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: rateLimitMock, rateLimitResponse: rateLimitResponseMock }))
vi.mock('@/lib/config/env', () => ({ getPronunciationEnv: getPronunciationEnvMock }))
vi.mock('@/lib/ai/pronunciation-provider', () => ({
  HttpPronunciationProvider: providerMock,
  PronunciationProviderError: class PronunciationProviderError extends Error {
    constructor(public code: string, message: string, public retryable: boolean, public status?: number) { super(message) }
  },
}))
vi.mock('@/lib/pronunciation-attempts', () => ({
  getStudentPronunciationAttemptState: getAttemptStateMock,
  getStudentPronunciationResult: getResultMock,
  recordPronunciationFailure: recordFailureMock,
  saveStudentPronunciationResult: saveResultMock,
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedAdminDb = vi.mocked(getAdminDb)
const mockedRateLimit = vi.mocked(consumeApiRateLimit)
const mockedRateLimitResponse = vi.mocked(rateLimitResponse)
const mockedEnv = vi.mocked(getPronunciationEnv)
const mockedProvider = vi.mocked(HttpPronunciationProvider)
const mockedAttemptState = vi.mocked(getStudentPronunciationAttemptState)
const mockedGetResult = vi.mocked(getStudentPronunciationResult)
const mockedRecordFailure = vi.mocked(recordPronunciationFailure)
const mockedSaveResult = vi.mocked(saveStudentPronunciationResult)

const result = {
  targetText: 'think clearly',
  transcript: 'think clearly',
  score: 88,
  confidence: 0.91,
  feedback: 'Focus on the th sound.',
  words: [{ word: 'think', expected: 'think', actual: 'think', score: 88, confidence: 0.91, startMs: 0, endMs: 500, phonemes: [{ phoneme: 'θ', expected: 'θ', actual: 'θ', score: 88, confidence: 0.91, startMs: 0, endMs: 80, issue: null }] }],
}

function audioRequest({ questionId = 'question-1', key = 'pronunciation-attempt-1', sample = new Uint8Array([1, 2, 3]) } = {}) {
  const form = new FormData()
  form.set('questionId', questionId)
  form.set('audio', new File([sample], 'pronunciation.wav', { type: 'audio/wav' }))
  return new NextRequest('https://tuturai-apps.netlify.app/api/student/pronunciation', {
    method: 'POST',
    headers: { 'Idempotency-Key': key, 'x-request-id': 'pronunciation-request-1' },
    body: form,
  })
}

function requestHash(questionId = 'question-1', sample = new Uint8Array([1, 2, 3])) {
  return createHash('sha256').update('student-123').update('\0').update(questionId).update('\0').update('audio/wav').update('\0').update(sample).digest('hex')
}

describe('/api/student/pronunciation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-123' } } as never)
    mockedAdminDb.mockReturnValue({
      collection: () => ({ doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'published', contentType: 'pronunciation', word: 'think clearly' }) }) }) }),
    } as never)
    mockedRateLimit.mockResolvedValue({ remaining: 9, resetAt: Date.now() + 60_000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedEnv.mockReturnValue({ route: 'v1', baseUrl: 'https://pronunciation.example.test', apiKey: 'secret', modelId: 'phoneme-model-v1', path: '/forced-align', timeoutMs: 30_000 })
    mockedProvider.mockImplementation(() => ({ align: vi.fn().mockResolvedValue(result) }) as never)
    mockedAttemptState.mockResolvedValue({ result: null, requestHash: null, status: null } as never)
    mockedGetResult.mockResolvedValue(null as never)
    mockedRecordFailure.mockResolvedValue({ status: 'failed', resultId: 'pronunciation-student-123' } as never)
    mockedSaveResult.mockResolvedValue({ id: 'pronunciation-student-123', studentId: 'student-123', questionId: 'question-1', ...result, createdAt: '2026-01-01T00:00:00.000Z' } as never)
  })

  it('requires a student session before accessing the provider', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 }) })
    const response = await POST(audioRequest())
    expect(response.status).toBe(401)
    expect(mockedProvider).not.toHaveBeenCalled()
  })

  it('normalizes real provider alignment and persists word/phoneme read-back', async () => {
    const response = await POST(audioRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ score: 88, transcript: 'think clearly', words: [{ phonemes: [{ phoneme: 'θ', score: 88 }] }] })
    expect(mockedRateLimit).toHaveBeenCalledWith({ scope: 'student-pronunciation', subject: 'student-123', limit: 10, windowMs: 60_000 })
    expect(mockedSaveResult).toHaveBeenCalledWith(expect.objectContaining({ questionId: 'question-1', studentId: 'student-123', modelId: 'phoneme-model-v1' }))
  })

  it('replays the persisted result for the same idempotency key without a second inference', async () => {
    mockedAttemptState.mockResolvedValue({ result: { id: 'pronunciation-student-123', score: 88 }, requestHash: requestHash(), status: 'completed' } as never)
    const response = await POST(audioRequest())
    expect(response.status).toBe(200)
    expect(mockedProvider).not.toHaveBeenCalled()
    expect(mockedRateLimit).not.toHaveBeenCalled()
  })

  it('rejects reuse of an idempotency key with a different audio request', async () => {
    mockedAttemptState.mockResolvedValue({ result: null, requestHash: 'different-hash', status: 'failed' } as never)
    const response = await POST(audioRequest())
    expect(response.status).toBe(409)
    expect((await response.json()).error.details.code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(mockedProvider).not.toHaveBeenCalled()
  })

  it('persists a retryable failed state when the provider is unavailable', async () => {
    mockedProvider.mockImplementation(() => ({ align: vi.fn().mockRejectedValue(new PronunciationProviderError('TIMEOUT', 'provider timeout', true)) }) as never)
    const response = await POST(audioRequest())
    const body = await response.json()
    expect(response.status).toBe(503)
    expect(body.error.details).toMatchObject({ code: 'TIMEOUT', retryable: true })
    expect(mockedRecordFailure).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'TIMEOUT', retryable: true }))
  })

  it('returns only the authenticated student pronunciation result', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-123' } } as never)
    mockedGetResult.mockResolvedValue({ id: 'pronunciation-student-123', studentId: 'student-123', score: 88 } as never)
    const response = await GET(new NextRequest('https://tuturai-apps.netlify.app/api/student/pronunciation?attemptId=pronunciation-student-123'))
    expect(response.status).toBe(200)
    expect(mockedGetResult).toHaveBeenCalledWith('student-123', 'pronunciation-student-123')
  })
})
