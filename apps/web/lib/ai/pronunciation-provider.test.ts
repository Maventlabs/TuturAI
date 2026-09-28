import { describe, expect, it, vi } from 'vitest'
import { HttpPronunciationProvider, PronunciationProviderError, normalizePronunciationResult } from './pronunciation-provider'

const providerResult = {
  transcript: 'think clearly',
  feedback: 'Focus on the unvoiced th in think.',
  confidence: 0.91,
  words: [
    {
      word: 'think',
      expected: 'think',
      actual: 'think',
      score: 84,
      confidence: 0.93,
      start_ms: 0,
      end_ms: 410,
      phonemes: [
        { phoneme: 'θ', expected: 'θ', actual: 'θ', score: 80, confidence: 0.9, start_ms: 0, end_ms: 80, issue: null },
      ],
    },
    {
      word: 'clearly',
      expected: 'clearly',
      actual: 'clearly',
      score: 92,
      confidence: 0.95,
      start_ms: 420,
      end_ms: 900,
      phonemes: [
        { phoneme: 'k', expected: 'k', actual: 'k', score: 92, confidence: 0.95, start_ms: 420, end_ms: 480, issue: null },
      ],
    },
  ],
}

describe('normalizePronunciationResult', () => {
  it('validates word and phoneme alignment and derives only the mean word score', () => {
    const result = normalizePronunciationResult(providerResult, 'think clearly')
    expect(result).toMatchObject({
      transcript: 'think clearly',
      targetText: 'think clearly',
      score: 88,
      confidence: 0.91,
    })
    expect(result.words[0]).toMatchObject({ word: 'think', score: 84, phonemes: [{ phoneme: 'θ', score: 80 }] })
  })

  it('rejects invalid phoneme scores instead of normalizing a fabricated value', () => {
    const malformed = structuredClone(providerResult)
    malformed.words[0].phonemes[0].score = 101
    expect(() => normalizePronunciationResult(malformed, 'think clearly')).toThrowError(expect.objectContaining({ code: 'INVALID_RESPONSE' }))
  })

  it('sends the configured model, path, idempotency key, and server-only bearer key', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(providerResult), { status: 200 }))
    const provider = new HttpPronunciationProvider({
      baseUrl: 'https://pronunciation.example.test',
      path: '/forced-align',
      modelId: 'phoneme-model-v1',
      apiKey: 'server-only-key',
      fetchImpl,
    })

    await provider.align({
      audio: new Uint8Array([1, 2]),
      mimeType: 'audio/wav',
      expectedText: 'think clearly',
      idempotencyKey: 'pronunciation-attempt-1',
    })
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://pronunciation.example.test/forced-align')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer server-only-key', 'Idempotency-Key': 'pronunciation-attempt-1' })
    expect(String(init?.body)).not.toContain('server-only-key')
  })

  it('retries a retryable provider outage once and normalizes the returned score', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(providerResult), { status: 200 }))
    const sleep = vi.fn(async () => {})
    const provider = new HttpPronunciationProvider({
      baseUrl: 'https://pronunciation.example.test', path: '/forced-align', modelId: 'model', fetchImpl, sleep,
    })

    await expect(provider.align({ audio: new Uint8Array([1]), mimeType: 'audio/wav', expectedText: 'think clearly', idempotencyKey: 'attempt-2' })).resolves.toMatchObject({ score: 88 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('does not retry malformed provider output', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ transcript: 'think' }), { status: 200 }))
    const provider = new HttpPronunciationProvider({ baseUrl: 'https://pronunciation.example.test', path: '/forced-align', modelId: 'model', fetchImpl })

    await expect(provider.align({ audio: new Uint8Array([1]), mimeType: 'audio/wav', expectedText: 'think', idempotencyKey: 'attempt-3' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    } satisfies Partial<PronunciationProviderError>)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
