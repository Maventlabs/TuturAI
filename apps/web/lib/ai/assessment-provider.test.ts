import { describe, expect, it, vi } from 'vitest'
import { AssessmentProviderError, HttpAssessmentProvider } from './assessment-provider'

const validAssessment = {
  pronunciation: 82,
  fluency: 76,
  intonation: 80,
  grammar: 74,
  vocabulary: 88,
  overall: 80,
  transcript: 'I enjoy learning English.',
  feedback: 'Good pacing.',
  confidence: 0.91,
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const openAiResponse = {
  choices: [{ message: { content: JSON.stringify(validAssessment) } }],
}

describe('HttpAssessmentProvider', () => {
  it('returns a normalized provider-confirmed assessment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(openAiResponse))
    const provider = new HttpAssessmentProvider({ baseUrl: 'https://ai.example.test', modelId: 'stt-model', fetchImpl })

    await expect(provider.assess({ audio: new Uint8Array([1, 2]), mimeType: 'audio/webm' })).resolves.toEqual(validAssessment)
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toBe('https://ai.example.test/chat/completions')
  })

  it('rejects malformed output without fabricating scores', async () => {
    const provider = new HttpAssessmentProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'stt-model',
      fetchImpl: vi.fn().mockResolvedValue(response({ choices: [{ message: { content: JSON.stringify({ transcript: 'hello', overall: 80 }) } }] })),
    })

    await expect(provider.assess({ audio: new Uint8Array([1]), mimeType: 'audio/webm' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    })
  })

  it('parses fenced JSON returned by an OpenAI-compatible provider', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(validAssessment)}\n\`\`\`` } }] }),
    )
    const provider = new HttpAssessmentProvider({ baseUrl: 'https://ai.example.test', modelId: 'llm-model', fetchImpl })

    await expect(provider.assess({ audio: new Uint8Array([1]), mimeType: 'audio/webm', transcript: 'hello' })).resolves.toEqual(validAssessment)
  })

  it('retries a timeout and succeeds on the next attempt', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('The operation timed out', 'TimeoutError'))
      .mockResolvedValueOnce(response(openAiResponse))
    const provider = new HttpAssessmentProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'stt-model',
      fetchImpl,
      maxAttempts: 2,
      sleep: async () => undefined,
    })

    await expect(provider.assess({ audio: new Uint8Array([1]), mimeType: 'audio/webm' })).resolves.toEqual(validAssessment)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry a client error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ error: 'bad request' }, 400))
    const provider = new HttpAssessmentProvider({ baseUrl: 'https://ai.example.test', modelId: 'stt-model', fetchImpl, maxAttempts: 3 })

    await expect(provider.assess({ audio: new Uint8Array([1]), mimeType: 'audio/webm' })).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
      retryable: false,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('retries a server error up to the configured attempt limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ error: 'unavailable' }, 503))
    const provider = new HttpAssessmentProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'stt-model',
      fetchImpl,
      maxAttempts: 3,
      sleep: async () => undefined,
    })

    await expect(provider.assess({ audio: new Uint8Array([1]), mimeType: 'audio/webm' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      retryable: true,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('stops immediately when the caller cancels', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn()
    const provider = new HttpAssessmentProvider({ baseUrl: 'https://ai.example.test', modelId: 'stt-model', fetchImpl })

    await expect(provider.assess({ audio: new Uint8Array([1]), mimeType: 'audio/webm', signal: controller.signal })).rejects.toBeInstanceOf(AssessmentProviderError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
