import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { DELETE, GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { HttpVoiceProvider, VoiceProviderError } from '@/lib/ai/voice-provider'
import { getTtsEnv } from '@/lib/config/env'
import {
  deleteTeacherVoiceProfile,
  failTeacherVoiceEnrollment,
  getTeacherVoiceProfile,
  getTeacherVoiceProfileState,
  saveTeacherVoiceProfile,
  startTeacherVoiceEnrollment,
  updateTeacherVoiceProfileStatus,
} from '@/lib/voice-profile'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/ai/voice-provider', () => ({
  HttpVoiceProvider: vi.fn(),
  VoiceProviderError: class VoiceProviderError extends Error {
    constructor(public code: string, message: string, public retryable: boolean) {
      super(message)
    }
  },
}))
vi.mock('@/lib/config/env', () => ({ getTtsEnv: vi.fn() }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }))
vi.mock('@/lib/voice-profile', () => ({
  deleteTeacherVoiceProfile: vi.fn(),
  failTeacherVoiceEnrollment: vi.fn(),
  getTeacherVoiceProfile: vi.fn(),
  getTeacherVoiceProfileState: vi.fn(),
  saveTeacherVoiceProfile: vi.fn(),
  startTeacherVoiceEnrollment: vi.fn(),
  updateTeacherVoiceProfileStatus: vi.fn(),
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedProvider = vi.mocked(HttpVoiceProvider)
const mockedGetTtsEnv = vi.mocked(getTtsEnv)
const mockedGetProfile = vi.mocked(getTeacherVoiceProfile)
const mockedGetProfileState = vi.mocked(getTeacherVoiceProfileState)
const mockedStartEnrollment = vi.mocked(startTeacherVoiceEnrollment)
const mockedSaveProfile = vi.mocked(saveTeacherVoiceProfile)
const mockedFailEnrollment = vi.mocked(failTeacherVoiceEnrollment)
const mockedUpdateStatus = vi.mocked(updateTeacherVoiceProfileStatus)
const mockedDeleteProfile = vi.mocked(deleteTeacherVoiceProfile)
const mockedConsumeLimit = vi.mocked(consumeApiRateLimit)
const mockedRateLimitResponse = vi.mocked(rateLimitResponse)
const mockedEnroll = vi.fn()
const mockedDeleteProviderVoice = vi.fn()
const mockedGetStatus = vi.fn()

function audioRequest(fields: Record<string, string>, key = 'stable-enrollment-key', sample = new Uint8Array([1, 2, 3])) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('audio', new File([sample], 'sample.wav', { type: 'audio/wav' }))
  return new NextRequest('http://localhost/api/teacher/voice-profile', { method: 'POST', headers: { 'Idempotency-Key': key }, body: form })
}

function profile(status: 'processing' | 'ready' | 'failed', providerVoiceId: string | null = 'voice-1') {
  return { id: 'teacher-1', teacherId: 'teacher-1', provider: 'omnivoice' as const, providerVoiceId, status, consentAt: '2026-09-23T00:00:00.000Z', createdAt: null, updatedAt: null, errorCode: status === 'failed' ? 'TIMEOUT' : null }
}

describe('/api/teacher/voice-profile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGetTtsEnv.mockReturnValue({ route: 'local', baseUrl: 'https://voice.example.test', apiKey: undefined, modelId: 'voice-test', enrollmentPath: '/v1/voice-clones', statusPath: '/v1/voice-clones', synthesisPath: '/v1/audio/speech', deletePath: '/v1/voice-clones' })
    mockedEnroll.mockResolvedValue({ providerVoiceId: 'voice-1', status: 'processing' })
    mockedDeleteProviderVoice.mockResolvedValue(undefined)
    mockedGetStatus.mockResolvedValue({ status: 'ready', errorCode: null })
    mockedProvider.mockImplementation(() => ({ enroll: mockedEnroll, delete: mockedDeleteProviderVoice, getStatus: mockedGetStatus }) as never)
    mockedGetProfile.mockResolvedValue(null)
    mockedGetProfileState.mockResolvedValue({ profile: null, idempotencyKey: null, requestHash: null } as never)
    mockedConsumeLimit.mockResolvedValue({ remaining: 2, resetAt: Date.now() + 60 * 60 * 1000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedStartEnrollment.mockResolvedValue({ profile: profile('processing', null), started: true } as never)
    mockedSaveProfile.mockResolvedValue(profile('processing') as never)
    mockedFailEnrollment.mockResolvedValue(profile('failed', null) as never)
    mockedUpdateStatus.mockResolvedValue(profile('ready') as never)
    mockedDeleteProfile.mockResolvedValue(undefined)
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
    expect(mockedStartEnrollment).not.toHaveBeenCalled()
  })

  it('requires a stable enrollment idempotency key', async () => {
    const response = await POST(audioRequest({ consent: 'true', referenceText: 'Hello world' }, ''))
    expect(response.status).toBe(400)
    expect(mockedEnroll).not.toHaveBeenCalled()
  })

  it('claims enrollment idempotently before sending consented audio to the provider', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedSaveProfile.mockResolvedValue(profile('processing') as never)
    const response = await POST(audioRequest({ consent: 'true', referenceText: 'Hello world' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.status).toBe('processing')
    expect(mockedStartEnrollment).toHaveBeenCalledWith('teacher-1', 'stable-enrollment-key', expect.stringMatching(/^[a-f0-9]{64}$/), expect.any(String))
    expect(mockedEnroll).toHaveBeenCalledWith(expect.objectContaining({
      referenceText: 'Hello world',
      idempotencyKey: 'stable-enrollment-key',
    }))
    expect(mockedSaveProfile).toHaveBeenCalledWith('teacher-1', { providerVoiceId: 'voice-1', status: 'processing' })
  })

  it('does not duplicate an in-progress enrollment when the same request is retried', async () => {
    const requestHash = createHash('sha256').update('teacher-1').update('\0').update('Hello world').update('\0').update(new Uint8Array([1, 2, 3])).digest('hex')
    mockedGetProfileState.mockResolvedValue({ profile: profile('processing', null), idempotencyKey: 'stable-enrollment-key', requestHash } as never)
    const response = await POST(audioRequest({ consent: 'true', referenceText: 'Hello world' }))
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.data.status).toBe('processing')
    expect(mockedEnroll).not.toHaveBeenCalled()
    expect(mockedStartEnrollment).not.toHaveBeenCalled()
  })

  it('rejects reuse of an idempotency key with a different audio payload', async () => {
    const requestHash = createHash('sha256').update('teacher-1').update('\0').update('Hello world').update('\0').update(new Uint8Array([1, 2, 3])).digest('hex')
    mockedGetProfileState.mockResolvedValue({ profile: profile('processing', null), idempotencyKey: 'stable-enrollment-key', requestHash } as never)
    const response = await POST(audioRequest({ consent: 'true', referenceText: 'Hello world' }, 'stable-enrollment-key', new Uint8Array([9, 9, 9])))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error.details.code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(mockedEnroll).not.toHaveBeenCalled()
  })

  it('polls processing status and persists provider-ready state', async () => {
    mockedGetProfile.mockResolvedValue(profile('processing') as never)
    mockedGetStatus.mockResolvedValue({ status: 'ready', errorCode: null })
    mockedUpdateStatus.mockResolvedValue(profile('ready') as never)
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('ready')
    expect(mockedGetStatus).toHaveBeenCalledWith('voice-1')
    expect(mockedUpdateStatus).toHaveBeenCalledWith('teacher-1', 'ready', null)
  })

  it('persists an enrollment failure as failed and retryable rather than ready', async () => {
    mockedEnroll.mockRejectedValue(new VoiceProviderError('TIMEOUT', 'provider timeout', true))
    const response = await POST(audioRequest({ consent: 'true', referenceText: 'Hello world' }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error.details).toMatchObject({ code: 'TIMEOUT', retryable: true, status: 'failed' })
    expect(mockedFailEnrollment).toHaveBeenCalledWith('teacher-1', 'TIMEOUT')
  })

  it('requires provider confirmation before deleting provider metadata', async () => {
    mockedGetProfile.mockResolvedValue(profile('ready') as never)
    const response = await DELETE()
    expect(response.status).toBe(200)
    expect(mockedDeleteProviderVoice).toHaveBeenCalledWith('voice-1')
    expect(mockedDeleteProfile).toHaveBeenCalledWith('teacher-1')
  })

  it('removes failed local state without inventing a remote voice id', async () => {
    mockedGetProfile.mockResolvedValue(profile('failed', null) as never)
    const response = await DELETE()
    expect(response.status).toBe(200)
    expect(mockedDeleteProviderVoice).not.toHaveBeenCalled()
    expect(mockedDeleteProfile).toHaveBeenCalledWith('teacher-1')
  })
})
