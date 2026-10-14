import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getAiEnv } from '@/lib/config/env'
import { processAssessment } from '@/lib/ai/assessment-processing'
import { HttpSttProvider } from '@/lib/ai/stt-provider'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/config/env', () => ({ getAiEnv: vi.fn() }))
vi.mock('@/lib/ai/assessment-processing', () => ({ processAssessment: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/scoring-persistence', () => ({ saveAssessment: vi.fn() }))
vi.mock('@/lib/api/rate-limit', () => ({
  consumeApiRateLimit: vi.fn().mockResolvedValue(undefined),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/ai/assessment-provider', () => ({ HttpAssessmentProvider: vi.fn() }))
vi.mock('@/lib/ai/stt-provider', () => ({
  HttpSttProvider: vi.fn(),
  SttProviderError: class extends Error {},
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedGetAiEnv = vi.mocked(getAiEnv)
const mockedProcess = vi.mocked(processAssessment)

function studentAuth() {
  return { ok: true as const, user: { uid: 'student-1', role: 'student' as const } } as never
}

function assessmentStub() {
  return {
    id: 'assessment-1',
    studentId: 'student-1',
    sessionId: 'session-1',
    pronunciation: 0,
    fluency: 78,
    intonation: 0,
    grammar: 82,
    vocabulary: 80,
    overall: 80,
  } as never
}

/** STT intentionally absent: the browser path must not need it. */
function llmOnlyEnv() {
  return {
    ai: {
      localBaseUrl: undefined,
      localApiKey: undefined,
      v1BaseUrl: 'https://llm.example/v1',
      v1ApiKey: 'k',
      stt: { route: 'v1' as const, baseUrl: undefined, apiKey: undefined, modelId: undefined },
      llm: { route: 'v1' as const, baseUrl: 'https://llm.example/v1', apiKey: 'k', modelId: 'm' },
      tts: {} as never,
    },
  } as never
}

function transcriptForm(extra: Record<string, string> = {}) {
  const form = new FormData()
  form.append('sessionId', 'session-1')
  form.append('transcript', 'Hello this is a short English sentence')
  form.append('spokenDurationMs', '5000')
  form.append('transcriptSource', 'browser_speech_api')
  // Use `set` so an override replaces the default instead of appending a second
  // value (FormData.get would otherwise return the original).
  for (const [key, value] of Object.entries(extra)) form.set(key, value)
  return form
}

function request(form: FormData) {
  return new Request('http://localhost/api/student/assessment', { method: 'POST', body: form }) as never
}

describe('/api/student/assessment transcript mode', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue(studentAuth())
    mockedGetAiEnv.mockReturnValue(llmOnlyEnv())
    mockedProcess.mockResolvedValue(assessmentStub())
  })

  it('accepts a browser transcript even when no STT endpoint is configured', async () => {
    const response = await POST(request(transcriptForm()))

    expect(response.status).toBe(200)
    expect(mockedProcess).toHaveBeenCalledTimes(1)
    const input = mockedProcess.mock.calls[0]![0] as unknown as {
      request: { transcript?: string }
      clientTranscript?: { audioVerified: boolean; durationPlausible: boolean }
      audioEvidence: { fluency: { wordCount: number; spokenDurationMs: number } }
    }
    expect(input.request.transcript).toBe('Hello this is a short English sentence')
    expect(input.clientTranscript?.audioVerified).toBe(false)
    // Server-derived, not client-asserted.
    expect(input.audioEvidence.fluency.wordCount).toBe(7)
    expect(input.audioEvidence.fluency.spokenDurationMs).toBe(5000)
  })

  it('never calls an STT provider on the transcript path', async () => {
    await POST(request(transcriptForm()))
    expect(HttpSttProvider).not.toHaveBeenCalled()
  })

  it('rejects an empty transcript with 400', async () => {
    const form = transcriptForm()
    form.set('transcript', '   ')
    const response = await POST(request(form))

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockedProcess).not.toHaveBeenCalled()
  })

  it('rejects a non-positive duration with 400', async () => {
    const response = await POST(request(transcriptForm({ spokenDurationMs: '0' })))

    expect(response.status).toBe(400)
    expect(mockedProcess).not.toHaveBeenCalled()
  })

  it('rejects an over-long transcript with 400', async () => {
    const response = await POST(request(transcriptForm({ transcript: 'a '.repeat(4000) })))

    expect(response.status).toBe(400)
    expect(mockedProcess).not.toHaveBeenCalled()
  })

  it('rejects a request with neither audio nor transcript', async () => {
    const form = new FormData()
    form.append('sessionId', 'session-1')
    const response = await POST(request(form))

    expect(response.status).toBe(400)
    expect(mockedProcess).not.toHaveBeenCalled()
  })

  it('flags an implausible duration instead of trusting it for fluency', async () => {
    const response = await POST(request(transcriptForm({ spokenDurationMs: '1000' })))

    expect(response.status).toBe(200)
    const input = mockedProcess.mock.calls[0]![0] as unknown as {
      clientTranscript?: { durationPlausible: boolean }
      audioEvidence: { fluency: { spokenDurationMs: number } }
    }
    expect(input.clientTranscript?.durationPlausible).toBe(false)
    // 7 words in 1s would be 420 WPM; the server must not let that stand.
    expect(input.audioEvidence.fluency.spokenDurationMs).toBeGreaterThan(2000)
  })

  it('fails closed with 503 when the LLM provider is unavailable', async () => {
    mockedGetAiEnv.mockImplementation(() => {
      throw new Error('AI provider is not configured')
    })
    const response = await POST(request(transcriptForm()))

    expect(response.status).toBe(503)
    expect(mockedProcess).not.toHaveBeenCalled()
  })
})