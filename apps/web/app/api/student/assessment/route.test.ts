import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { getSessionProfile } from '@/lib/auth'
import { getAiEnv } from '@/lib/config/env'

vi.mock('@/lib/auth', () => ({ getSessionProfile: vi.fn() }))
vi.mock('@/lib/config/env', () => ({ getAiEnv: vi.fn() }))

const mockedAuth = vi.mocked(getSessionProfile)
const mockedAiEnv = vi.mocked(getAiEnv)

function requestWithForm(form: FormData) {
  return new NextRequest('http://localhost/api/student/assessment', { method: 'POST', body: form })
}

describe('POST /api/student/assessment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedAuth.mockResolvedValue({ user: null, profile: null, isDemo: false })
  })

  it('rejects unauthenticated requests', async () => {
    const response = await POST(requestWithForm(new FormData()))
    expect(response.status).toBe(401)
  })

  it('fails closed when speech providers are not configured', async () => {
    mockedAuth.mockResolvedValue({
      user: { uid: 'student-1', email: 'student@example.com', displayName: 'Student' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student', email: 'student@example.com', school: null, class: null, nip: null, subject: null, xp: 0, level: 1 },
      isDemo: false,
    })
    mockedAiEnv.mockReturnValue({ ai: { stt: { baseUrl: undefined, modelId: 'whisper' }, llm: { baseUrl: undefined, modelId: 'llm' } } } as never)
    const form = new FormData()
    form.set('sessionId', 'session-1')
    form.set('audio', new File([new Uint8Array([1])], 'speech.webm', { type: 'audio/webm' }))

    const response = await POST(requestWithForm(form))
    expect(response.status).toBe(503)
  })
})
