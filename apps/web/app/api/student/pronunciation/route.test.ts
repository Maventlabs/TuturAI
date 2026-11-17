import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpSttProvider, SttProviderError } from '@/lib/ai/stt-provider'
import { getAiEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getStudentPronunciationAttemptState, getStudentPronunciationResult, recordPronunciationFailure, saveStudentPronunciationResult } from '@/lib/pronunciation-attempts'

const { requireRoleMock, getAdminDbMock, rateLimitMock, rateLimitResponseMock, getAiEnvMock, sttProviderMock, getAttemptStateMock, getResultMock, recordFailureMock, saveResultMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  getAdminDbMock: vi.fn(),
  rateLimitMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
  getAiEnvMock: vi.fn(),
  sttProviderMock: vi.fn(),
  getAttemptStateMock: vi.fn(),
  getResultMock: vi.fn(),
  recordFailureMock: vi.fn(),
  saveResultMock: vi.fn(),
}))

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: requireRoleMock }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: getAdminDbMock }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: rateLimitMock, rateLimitResponse: rateLimitResponseMock }))
vi.mock('@/lib/config/env', () => ({ getAiEnv: getAiEnvMock }))
vi.mock('@/lib/ai/stt-provider', () => ({
  HttpSttProvider: sttProviderMock,
  SttProviderError: class SttProviderError extends Error {
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
const mockedEnv = vi.mocked(getAiEnv)
const mockedStt = vi.mocked(HttpSttProvider)
const mockedAttemptState = vi.mocked(getStudentPronunciationAttemptState)
const mockedGetResult = vi.mocked(getStudentPronunciationResult)
const mockedRecordFailure = vi.mocked(recordPronunciationFailure)
const mockedSaveResult = vi.mocked(saveStudentPronunciationResult)

const saved = {
  id: 'pronunciation-student-123',
  studentId: 'student-123',
  questionId: 'question-1',
  targetText: 'thorough',
  transcript: 'thorough',
  heardWord: 'thorough',
  score: 100,
  confidence: null,
  verdict: 'correct' as const,
  feedback: 'Pelafalan "thorough" sudah jelas dan cocok dengan target.',
  segments: [{ target: 'thorough', heard: 'thorough', match: true }],
  createdAt: '2026-01-01T00:00:00.000Z',
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
      collection: () => ({ doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'published', contentType: 'pronunciation', word: 'thorough' }) }) }) }),
    } as never)
    mockedRateLimit.mockResolvedValue({ remaining: 9, resetAt: Date.now() + 60_000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedEnv.mockReturnValue({
      ai: { stt: { route: 'v1', path: '/audio/transcriptions', baseUrl: 'https://stt.example.test', apiKey: 'secret', modelId: 'whisper-large-v3' } },
    } as never)
    mockedStt.mockImplementation(() => ({ transcribe: vi.fn().mockResolvedValue({ text: 'thorough', confidence: null }) }) as never)
    mockedAttemptState.mockResolvedValue({ result: null, requestHash: null, status: null } as never)
    mockedGetResult.mockResolvedValue(null as never)
    mockedRecordFailure.mockResolvedValue({ status: 'failed', resultId: 'pronunciation-student-123' } as never)
    mockedSaveResult.mockImplementation((input) => Promise.resolve({
      ...saved,
      ...input.result,
      id: saved.id,
      studentId: saved.studentId,
      questionId: saved.questionId,
      createdAt: saved.createdAt,
    }) as never)
  })

  it('requires a student session before transcribing', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 }) })
    const response = await POST(audioRequest())
    expect(response.status).toBe(401)
    expect(mockedStt).not.toHaveBeenCalled()
  })

  it('scores the single recognized word and persists the read-back', async () => {
    const response = await POST(audioRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ score: 100, transcript: 'thorough', heardWord: 'thorough', verdict: 'correct' })
    expect(mockedRateLimit).toHaveBeenCalledWith({ scope: 'student-pronunciation', subject: 'student-123', limit: 10, windowMs: 60_000 })
    expect(mockedSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'question-1',
      studentId: 'student-123',
      modelId: 'whisper-large-v3',
      result: expect.objectContaining({ targetText: 'thorough', score: 100 }),
    }))
  })

  it('scores a near miss below a perfect match', async () => {
    mockedStt.mockImplementation(() => ({ transcribe: vi.fn().mockResolvedValue({ text: 'torough', confidence: null }) }) as never)
    const response = await POST(audioRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.score).toBeGreaterThan(1)
    expect(body.data.score).toBeLessThan(100)
    expect(body.data.verdict).not.toBe('correct')
  })

  it('replays the persisted result for the same idempotency key without a second inference', async () => {
    mockedAttemptState.mockResolvedValue({ result: { id: 'pronunciation-student-123', score: 100 }, requestHash: requestHash(), status: 'completed' } as never)
    const response = await POST(audioRequest())
    expect(response.status).toBe(200)
    expect(mockedStt).not.toHaveBeenCalled()
    expect(mockedRateLimit).not.toHaveBeenCalled()
  })

  it('rejects reuse of an idempotency key with a different audio request', async () => {
    mockedAttemptState.mockResolvedValue({ result: null, requestHash: 'different-hash', status: 'failed' } as never)
    const response = await POST(audioRequest())
    expect(response.status).toBe(409)
    expect((await response.json()).error.details.code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(mockedStt).not.toHaveBeenCalled()
  })

  it('persists a retryable failed state when the recognizer is unavailable', async () => {
    mockedStt.mockImplementation(() => ({ transcribe: vi.fn().mockRejectedValue(new SttProviderError('TIMEOUT', 'provider timeout', true)) }) as never)
    const response = await POST(audioRequest())
    const body = await response.json()
    expect(response.status).toBe(503)
    expect(body.error.details).toMatchObject({ code: 'TIMEOUT', retryable: true })
    expect(mockedRecordFailure).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'TIMEOUT', retryable: true }))
  })

  it('returns only the authenticated student pronunciation result', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-123' } } as never)
    mockedGetResult.mockResolvedValue({ id: 'pronunciation-student-123', studentId: 'student-123', score: 100 } as never)
    const response = await GET(new NextRequest('https://tuturai-apps.netlify.app/api/student/pronunciation?attemptId=pronunciation-student-123'))
    expect(response.status).toBe(200)
    expect(mockedGetResult).toHaveBeenCalledWith('student-123', 'pronunciation-student-123')
  })
})
