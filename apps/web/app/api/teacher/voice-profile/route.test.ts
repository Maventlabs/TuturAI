import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { DELETE, GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpVoiceProvider } from '@/lib/ai/voice-provider'
import { getAiEnv } from '@/lib/config/env'
import { deleteTeacherVoiceProfile, getTeacherVoiceProfile, saveTeacherVoiceProfile } from '@/lib/voice-profile'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/ai/voice-provider', () => ({ HttpVoiceProvider: vi.fn() }))
vi.mock('@/lib/config/env', () => ({ getAiEnv: vi.fn() }))
vi.mock('@/lib/voice-profile', () => ({
  deleteTeacherVoiceProfile: vi.fn(),
  getTeacherVoiceProfile: vi.fn(),
  saveTeacherVoiceProfile: vi.fn(),
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedProvider = vi.mocked(HttpVoiceProvider)
const mockedGetAiEnv = vi.mocked(getAiEnv)
const mockedGetProfile = vi.mocked(getTeacherVoiceProfile)
const mockedSaveProfile = vi.mocked(saveTeacherVoiceProfile)
const mockedDeleteProfile = vi.mocked(deleteTeacherVoiceProfile)

function audioRequest(fields: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('audio', new File([new Uint8Array([1, 2, 3])], 'sample.wav', { type: 'audio/wav' }))
  return new NextRequest('http://localhost/api/teacher/voice-profile', { method: 'POST', body: form })
}

describe('/api/teacher/voice-profile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedGetAiEnv.mockReturnValue({ ai: { tts: { route: 'local', baseUrl: 'http://localhost:3900', apiKey: undefined } } } as never)
    mockedProvider.mockImplementation(() => ({ enroll: vi.fn().mockResolvedValue({ providerVoiceId: 'voice-1', status: 'processing' }), delete: vi.fn().mockResolvedValue(undefined) }) as never)
  })

  it('rejects non-teachers before reading the voice profile', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })
    const response = await GET()
    expect(response.status).toBe(403)
    expect(mockedGetProfile).not.toHaveBeenCalled()
  })

  it('fails closed when consent is missing', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    const response = await POST(audioRequest({ consent: 'false', referenceText: 'Hello' }))
    expect(response.status).toBe(400)
    expect(mockedSaveProfile).not.toHaveBeenCalled()
  })

  it('persists only provider metadata after confirmed enrollment', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedSaveProfile.mockResolvedValue({ id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice', providerVoiceId: 'voice-1', status: 'processing', consentAt: '2026-09-23T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: null })
    const response = await POST(audioRequest({ consent: 'true', referenceText: 'Hello world' }))
    expect(response.status).toBe(201)
    expect(mockedSaveProfile).toHaveBeenCalledWith('teacher-1', { providerVoiceId: 'voice-1', status: 'processing' }, expect.any(String))
  })

  it('requires the provider to confirm deletion before removing local metadata', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGetProfile.mockResolvedValue({ id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice', providerVoiceId: 'voice-1', status: 'ready', consentAt: '2026-09-23T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: null })
    const response = await DELETE()
    expect(response.status).toBe(200)
    expect(mockedDeleteProfile).toHaveBeenCalledWith('teacher-1')
  })
})
