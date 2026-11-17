import { describe, expect, it, vi } from 'vitest'
import { ConversationProviderError, HttpConversationProvider } from './conversation-provider'

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function completion(content: string) {
  return { choices: [{ message: { role: 'assistant', content } }] }
}

const messages = [
  { role: 'system' as const, content: 'You are a tutor.' },
  { role: 'user' as const, content: 'I like play football.' },
]

describe('HttpConversationProvider', () => {
  it('posts an OpenAI-compatible JSON completion request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(completion('{"spoken_response":"Nice!"}')))
    const provider = new HttpConversationProvider({
      baseUrl: 'https://ai.example.test/',
      modelId: 'tutor-model',
      apiKey: 'secret',
      fetchImpl,
    })

    await expect(provider.complete(messages)).resolves.toEqual({ spoken_response: 'Nice!' })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ai.example.test/chat/completions')
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer secret',
    })

    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('tutor-model')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages).toEqual(messages)
  })

  it('parses JSON wrapped in a markdown fence', async () => {
    const provider = new HttpConversationProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'tutor-model',
      fetchImpl: vi.fn().mockResolvedValue(response(completion('```json\n{"spoken_response":"Hi"}\n```'))),
    })

    await expect(provider.complete(messages)).resolves.toEqual({ spoken_response: 'Hi' })
  })

  it('retries a provider outage once before succeeding', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response(completion('{"spoken_response":"Back"}')))
    const provider = new HttpConversationProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'tutor-model',
      fetchImpl,
      sleep: async () => {},
    })

    await expect(provider.complete(messages)).resolves.toEqual({ spoken_response: 'Back' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('surfaces a rate limit as a retryable error', async () => {
    const provider = new HttpConversationProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'tutor-model',
      maxAttempts: 1,
      fetchImpl: vi.fn().mockResolvedValue(response({}, 429)),
    })

    await expect(provider.complete(messages)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    })
  })

  it('rejects a non-JSON message body instead of guessing', async () => {
    const provider = new HttpConversationProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'tutor-model',
      fetchImpl: vi.fn().mockResolvedValue(response(completion('Sure! Here is my answer.'))),
    })

    await expect(provider.complete(messages)).rejects.toBeInstanceOf(ConversationProviderError)
    await expect(provider.complete(messages)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('does not retry a rejected request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({}, 400))
    const provider = new HttpConversationProvider({
      baseUrl: 'https://ai.example.test',
      modelId: 'tutor-model',
      fetchImpl,
      sleep: async () => {},
    })

    await expect(provider.complete(messages)).rejects.toMatchObject({ code: 'PROVIDER_REJECTED', retryable: false })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
