import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTtsAttempts, synthesizeWithFailover } from './tts-synthesis'
import { VoiceProviderError } from './voice-provider'

const config = {
  baseUrl: 'https://tts.test/v1',
  apiKeys: ['key-a'],
  modelIds: ['model-1', 'model-2'],
  attemptTimeoutMs: 10_000,
  synthesisPath: '/audio/speech',
}

function audioResponse() {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
}

function requestBody(fetchImpl: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(String((fetchImpl.mock.calls[call][1] as RequestInit).body))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildTtsAttempts', () => {
  it('pairs every model with every key, primary first', () => {
    expect(buildTtsAttempts({ modelIds: ['m1', 'm2'], apiKeys: ['k1', 'k2'] })).toEqual([
      { modelId: 'm1', apiKey: 'k1' },
      { modelId: 'm1', apiKey: 'k2' },
      { modelId: 'm2', apiKey: 'k1' },
      { modelId: 'm2', apiKey: 'k2' },
    ])
  })

  it('still attempts once when nothing is configured', () => {
    expect(buildTtsAttempts({ modelIds: [], apiKeys: [] })).toEqual([{ modelId: undefined, apiKey: undefined }])
  })
})

describe('synthesizeWithFailover', () => {
  it('returns the first successful model', async () => {
    const fetchImpl = vi.fn(async () => audioResponse())

    const result = await synthesizeWithFailover(config, { providerVoiceId: 'v1', text: 'halo' }, { fetchImpl })

    expect(result.audio.byteLength).toBe(3)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(requestBody(fetchImpl, 0)).toMatchObject({ model: 'model-1' })
  })

  it('falls through to the next model when one fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(audioResponse())

    const result = await synthesizeWithFailover(config, { providerVoiceId: 'v1', text: 'halo' }, { fetchImpl })

    expect(result.audio.byteLength).toBe(3)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(requestBody(fetchImpl, 1)).toMatchObject({ model: 'model-2' })
  })

  it('falls through when an attempt times out', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(audioResponse())

    const result = await synthesizeWithFailover(config, { providerVoiceId: 'v1', text: 'halo' }, { fetchImpl })

    expect(result.audio.byteLength).toBe(3)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rethrows the last provider error when every model fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))

    await expect(synthesizeWithFailover(config, { providerVoiceId: 'v1', text: 'halo' }, { fetchImpl }))
      .rejects.toBeInstanceOf(VoiceProviderError)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('fails over across Gemini models on the native endpoint', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const geminiAudio = new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: Buffer.from([1, 2, 3]).toString('base64') } }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":{"message":"model not found"}}', { status: 404 }))
      .mockResolvedValueOnce(geminiAudio)

    const result = await synthesizeWithFailover(
      { ...config, baseUrl: 'https://generativelanguage.googleapis.com', protocol: 'gemini', modelIds: ['bad-model', 'good-model'] },
      { providerVoiceId: 'clone-1', text: 'halo' },
      { fetchImpl },
    )

    expect(result.contentType).toBe('audio/wav')
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/good-model:generateContent',
    )
  })
})
