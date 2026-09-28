import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpVoiceProvider } from '@/lib/ai/voice-provider'
import { getTtsEnv } from '@/lib/config/env'
import { getTeacherVoiceProfile } from '@/lib/voice-profile'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/ai/voice-provider', () => ({ HttpVoiceProvider: vi.fn() }))
vi.mock('@/lib/config/env', () => ({ getTtsEnv: vi.fn() }))
vi.mock('@/lib/voice-profile', () => ({ getTeacherVoiceProfile: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedProvider = vi.mocked(HttpVoiceProvider)
const mockedGetTtsEnv = vi.mocked(getTtsEnv)
const mockedGetProfile = vi.mocked(getTeacherVoiceProfile)

function request(text: unknown) {
  return new NextRequest('http://localhost/api/teacher/voice-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
}

describe('/api/teacher/voice-preview', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGetProfile.mockResolvedValue({ id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice', providerVoiceId: 'voice-1', status: 'ready', consentAt: '2026-09-23T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: null })
    mockedGetTtsEnv.mockReturnValue({ route: 'local', baseUrl: 'http://localhost:3900', apiKey: undefined, modelId: 'omnivoice-v1', statusPath: '/v1/voice-clones', enrollmentPath: '/v1/voice-clones', synthesisPath: '/v1/audio/speech', deletePath: '/v1/voice-clones' })
    mockedProvider.mockImplementation(() => ({ synthesize: vi.fn().mockResolvedValue({ audio: new ArrayBuffer(2), contentType: 'audio/wav' }) }) as never)
  })

  it('rejects unauthorized requests', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })
    expect((await POST(request('Hello'))).status).toBe(403)
  })

  it('requires a ready teacher-isolated voice profile', async () => {
    mockedGetProfile.mockResolvedValue(null)
    expect((await POST(request('Hello'))).status).toBe(409)
  })

  it('returns provider audio only after the profile and provider confirm', async () => {
    const response = await POST(request('Hello class.'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('audio/wav')
  })
})
