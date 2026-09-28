import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getAiEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'

const { requireRoleMock, getAdminDbMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn(), getAdminDbMock: vi.fn() }))
vi.mock('@/lib/api/auth-guard', () => ({ requireRole: requireRoleMock }))
vi.mock('@/lib/config/env', () => ({ getAiEnv: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: getAdminDbMock }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }))

const mockedAuth = vi.mocked(requireRole)
const mockedAiEnv = vi.mocked(getAiEnv)
const mockedAdminDb = vi.mocked(getAdminDb)
const mockedConsumeRateLimit = vi.mocked(consumeApiRateLimit)
const mockedRateLimitResponse = vi.mocked(rateLimitResponse)

function requestWithForm(form: FormData) {
  return new NextRequest('http://localhost/api/student/assessment', { method: 'POST', body: form })
}

describe('POST /api/student/assessment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedAuth.mockResolvedValue({ ok: false, response: Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 }) } as never)
    mockedConsumeRateLimit.mockResolvedValue({ remaining: 10, resetAt: Date.now() + 60_000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedAdminDb.mockReturnValue({
      collection: () => ({ doc: (id: string) => ({ get: async () => ({ id, exists: id === 'student-1_session-1', data: () => ({ id, studentId: 'student-1', sessionId: 'session-1', transcript: 'hello', overall: 80 }) }) }) }),
    } as never)
  })

  it('rejects unauthenticated requests', async () => {
    const response = await POST(requestWithForm(new FormData()))
    expect(response.status).toBe(401)
  })

  it('fails closed when speech providers are not configured', async () => {
    mockedAuth.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedAiEnv.mockReturnValue({ ai: { stt: { baseUrl: undefined, modelId: 'whisper' }, llm: { baseUrl: undefined, modelId: 'llm' } } } as never)
    const form = new FormData()
    form.set('sessionId', 'session-1')
    form.set('audio', new File([new Uint8Array([1])], 'speech.webm', { type: 'audio/webm' }))

    const response = await POST(requestWithForm(form))
    expect(response.status).toBe(503)
  })

  it('reads back only the authenticated student assessment after offline replay', async () => {
    mockedAuth.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    const response = await GET(new NextRequest('https://tuturai-apps.netlify.app/api/student/assessment?sessionId=session-1'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { id: 'student-1_session-1', studentId: 'student-1', overall: 80 } })
  })

  it('does not disclose an assessment belonging to another student', async () => {
    mockedAuth.mockResolvedValue({ ok: true, user: { uid: 'student-2' } } as never)
    const response = await GET(new NextRequest('https://tuturai-apps.netlify.app/api/student/assessment?sessionId=session-1'))
    expect(response.status).toBe(404)
  })
})
