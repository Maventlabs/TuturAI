import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpVoiceProvider } from '@/lib/ai/voice-provider'
import { getAiEnv } from '@/lib/config/env'
import { getStudentClassroomVoiceProfile } from '@/lib/voice-profile'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/ai/voice-provider', () => ({
  HttpVoiceProvider: vi.fn(),
  VoiceProviderError: class VoiceProviderError extends Error {
    code = 'PROVIDER_UNAVAILABLE'
    retryable = true
  },
}))
vi.mock('@/lib/config/env', () => ({ getAiEnv: vi.fn() }))
vi.mock('@/lib/voice-profile', () => ({ getStudentClassroomVoiceProfile: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedProvider = vi.mocked(HttpVoiceProvider)
const mockedGetAiEnv = vi.mocked(getAiEnv)
const mockedGetProfile = vi.mocked(getStudentClassroomVoiceProfile)

function request(text: unknown) {
  return new NextRequest('http://localhost/api/classrooms/class-1/voice', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

describe('/api/classrooms/[classroomId]/voice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedGetAiEnv.mockReturnValue({ ai: { tts: { route: 'local', baseUrl: 'http://localhost:3900', apiKey: undefined, modelId: 'omnivoice-v1', synthesisPath: '/v1/audio/speech' } } } as never)
    mockedProvider.mockImplementation(() => ({ synthesize: vi.fn().mockResolvedValue({ audio: new ArrayBuffer(2), contentType: 'audio/wav' }) }) as never)
  })

  it('rejects unauthorized requests before reading classroom voice metadata', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })
    expect((await POST(request('Hello'), { params: Promise.resolve({ classroomId: 'class-1' }) })).status).toBe(403)
    expect(mockedGetProfile).not.toHaveBeenCalled()
  })

  it('denies students outside the classroom boundary', async () => {
    mockedGetProfile.mockRejectedValue(new Error('CLASSROOM_NOT_FOUND'))
    expect((await POST(request('Hello'), { params: Promise.resolve({ classroomId: 'class-1' }) })).status).toBe(404)
  })

  it('does not fabricate audio while the teacher profile is processing', async () => {
    mockedGetProfile.mockResolvedValue({ id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice', providerVoiceId: 'voice-1', status: 'processing', consentAt: '2026-09-24T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: null })
    const response = await POST(request('Hello class.'), { params: Promise.resolve({ classroomId: 'class-1' }) })
    expect(response.status).toBe(409)
    expect(mockedProvider).not.toHaveBeenCalled()
  })

  it('returns audio only after classroom profile and provider confirm', async () => {
    mockedGetProfile.mockResolvedValue({ id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice', providerVoiceId: 'voice-1', status: 'ready', consentAt: '2026-09-24T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: null })
    const response = await POST(request('Hello class.'), { params: Promise.resolve({ classroomId: 'class-1' }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('audio/wav')
  })

  it('surfaces provider failure without returning fabricated audio', async () => {
    mockedGetProfile.mockResolvedValue({ id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice', providerVoiceId: 'voice-1', status: 'ready', consentAt: '2026-09-24T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: null })
    mockedProvider.mockImplementation(() => ({ synthesize: vi.fn().mockRejectedValue(new Error('TTS unavailable')) }) as never)
    const response = await POST(request('Hello class.'), { params: Promise.resolve({ classroomId: 'class-1' }) })
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: { code: 'INTERNAL_ERROR' } })
  })
})
