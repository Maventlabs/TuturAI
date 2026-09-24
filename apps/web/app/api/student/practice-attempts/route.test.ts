import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { createPracticeAttempt } from '@/lib/practice-attempts'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/practice-attempts', () => ({
  createPracticeAttempt: vi.fn(),
  validatePracticeAttemptInput: (input: unknown) => {
    if (!input || typeof input !== 'object') return { success: false, message: 'Practice attempt payload is required' }
    const value = input as Record<string, unknown>
    if (value.contentType !== 'pronunciation') return { success: false, message: 'Unsupported practice type' }
     return { success: true, data: { questionId: String(value.questionId), contentType: 'pronunciation' as const, idempotencyKey: String(value.idempotencyKey) } }
  },
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedCreatePracticeAttempt = vi.mocked(createPracticeAttempt)

function request(body: unknown) {
  return new NextRequest('http://localhost/api/student/practice-attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function requestWithIdempotency(body: unknown, idempotencyKey: string) {
  return new NextRequest('http://localhost/api/student/practice-attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  })
}

function malformedRequest() {
  return new NextRequest('http://localhost/api/student/practice-attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  })
}

describe('POST /api/student/practice-attempts', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects unauthenticated requests', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Unauthorized', { status: 401 }) })

    const response = await POST(request({ questionId: 'q-1', contentType: 'pronunciation', idempotencyKey: 'attempt-1' }))

    expect(response.status).toBe(401)
  })

  it('returns provider-unavailable metadata without a score', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedCreatePracticeAttempt.mockResolvedValue({ id: 'attempt-1', assessmentStatus: 'provider_unavailable', score: null })

    const response = await POST(request({ questionId: 'q-1', contentType: 'pronunciation', idempotencyKey: 'attempt-1' }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ data: { assessmentStatus: 'provider_unavailable', score: null } })
  })

  it('uses the idempotency header as the authoritative retry key', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedCreatePracticeAttempt.mockResolvedValue({ id: 'attempt-1', assessmentStatus: 'provider_unavailable', score: null })

    await POST(requestWithIdempotency({ questionId: 'q-1', contentType: 'pronunciation', idempotencyKey: 'body-key' }, 'header-key'))

    expect(mockedCreatePracticeAttempt).toHaveBeenCalledWith('student-1', {
      questionId: 'q-1',
      contentType: 'pronunciation',
      idempotencyKey: 'header-key',
    })
  })

  it('returns a validation error for malformed JSON', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)

    const response = await POST(malformedRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })
})
