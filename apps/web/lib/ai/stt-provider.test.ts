import { describe, expect, it, vi } from 'vitest'
import { HttpSttProvider, SttProviderError } from './stt-provider'

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe('HttpSttProvider', () => {
  it('sends audio as a multipart transcription request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ text: 'Hello from class.' }))
    const provider = new HttpSttProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'whisper-large-v3',
      apiKey: 'secret',
      fetchImpl,
    })

    await expect(
      provider.transcribe({ audio: new Uint8Array([1, 2]), mimeType: 'audio/webm', language: 'en' }),
    ).resolves.toEqual({ text: 'Hello from class.', confidence: null })

    const [, init] = fetchImpl.mock.calls[0]
    const body = init.body as FormData
    expect(fetchImpl.mock.calls[0][0]).toBe('https://ai.example.test/audio/transcriptions')
    expect(init.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer secret' })
    expect(body.get('model')).toBe('whisper-large-v3')
    expect(body.get('language')).toBe('en')
    expect(body.get('file')).toBeInstanceOf(Blob)
  })

  it('accepts an optional provider confidence without fabricating one', async () => {
    const provider = new HttpSttProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'whisper-large-v3',
      fetchImpl: vi.fn().mockResolvedValue(response({ text: 'Hello.', confidence: 0.8 })),
    })

    await expect(provider.transcribe({ audio: new Uint8Array([1]), mimeType: 'audio/wav' })).resolves.toEqual({
      text: 'Hello.',
      confidence: 0.8,
    })
  })

  it('rejects malformed output without inventing a transcript', async () => {
    const provider = new HttpSttProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'whisper-large-v3',
      fetchImpl: vi.fn().mockResolvedValue(response({ confidence: 0.8 })),
    })

    await expect(provider.transcribe({ audio: new Uint8Array([1]), mimeType: 'audio/wav' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    })
  })

  it('retries timeout and server failures but not client failures', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('The operation timed out', 'TimeoutError'))
      .mockResolvedValueOnce(response({ error: 'busy' }, 503))
      .mockResolvedValueOnce(response({ text: 'Recovered.' }))
    const provider = new HttpSttProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'whisper-large-v3',
      fetchImpl,
      maxAttempts: 3,
      sleep: async () => undefined,
    })

    await expect(provider.transcribe({ audio: new Uint8Array([1]), mimeType: 'audio/wav' })).resolves.toEqual({
      text: 'Recovered.',
      confidence: null,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)

    const rejected = new HttpSttProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'whisper-large-v3',
      fetchImpl: vi.fn().mockResolvedValue(response({ error: 'bad request' }, 400)),
      maxAttempts: 3,
    })
    await expect(rejected.transcribe({ audio: new Uint8Array([1]), mimeType: 'audio/wav' })).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
      retryable: false,
    })
  })

  it('does not call the provider after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn()
    const provider = new HttpSttProvider({ baseUrl: 'https://ai.example.test', modelId: 'whisper-large-v3', fetchImpl })

    await expect(provider.transcribe({ audio: new Uint8Array([1]), mimeType: 'audio/wav', signal: controller.signal })).rejects.toBeInstanceOf(
      SttProviderError,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
