import { describe, expect, it, vi } from 'vitest'
import { VoiceProviderError, HttpVoiceProvider } from './voice-provider'

describe('HttpVoiceProvider', () => {
  it('enrolls a voice clone and returns the provider voice id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'voice-1', status: 'processing' }), { status: 202 }))
    const provider = new HttpVoiceProvider({ baseUrl: 'http://localhost:3900', fetchImpl })

    const result = await provider.enroll({ audio: new Uint8Array([1, 2]), mimeType: 'audio/wav', filename: 'sample.wav', referenceText: 'Hello world' })

    expect(result).toEqual({ providerVoiceId: 'voice-1', status: 'processing' })
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3900/v1/voice-clones', expect.objectContaining({ method: 'POST' }))
  })

  it('rejects malformed provider responses without fabricating a voice id', async () => {
    const provider = new HttpVoiceProvider({
      baseUrl: 'http://localhost:3900',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: 'ready' }), { status: 200 })),
    })

    await expect(provider.enroll({ audio: new Uint8Array([1]), mimeType: 'audio/wav', referenceText: 'Hello' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    })
  })

  it('maps an unavailable sidecar to a retryable error', async () => {
    const provider = new HttpVoiceProvider({
      baseUrl: 'http://localhost:3900',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('unavailable', { status: 503 })),
    })

    await expect(provider.enroll({ audio: new Uint8Array([1]), mimeType: 'audio/wav', referenceText: 'Hello' })).rejects.toBeInstanceOf(VoiceProviderError)
    await expect(provider.enroll({ audio: new Uint8Array([1]), mimeType: 'audio/wav', referenceText: 'Hello' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      retryable: true,
    })
  })

  it('does not send an empty reference audio payload', async () => {
    const provider = new HttpVoiceProvider({
      baseUrl: 'http://localhost:3900',
      fetchImpl: vi.fn<typeof fetch>(),
    })

    await expect(provider.enroll({ audio: new Uint8Array(), mimeType: 'audio/wav', referenceText: 'Hello' })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      retryable: false,
    })
  })

  it('returns provider audio bytes for a confirmed voice profile', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([82, 73, 70, 70]), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const provider = new HttpVoiceProvider({ baseUrl: 'http://localhost:3900', modelId: 'omnivoice-v1', fetchImpl })
    const audio = await provider.synthesize({ providerVoiceId: 'voice-1', text: 'Hello class.' })
    expect(Array.from(new Uint8Array(audio.audio))).toEqual([82, 73, 70, 70])
    expect(audio.contentType).toBe('audio/wav')
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3900/v1/audio/speech', expect.objectContaining({ method: 'POST' }))
  })

  it('uses configured OmniVoice endpoint paths', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'voice-2', status: 'ready' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'audio/wav' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const provider = new HttpVoiceProvider({
      baseUrl: 'http://localhost:1234',
      enrollmentPath: '/omnivoice/enroll',
      synthesisPath: '/omnivoice/synthesize',
      deletePath: '/omnivoice/voices',
      fetchImpl,
    })

    await provider.enroll({ audio: new Uint8Array([1]), mimeType: 'audio/wav', referenceText: 'Hello' })
    await provider.synthesize({ providerVoiceId: 'voice-2', text: 'Hello' })
    await provider.delete('voice-2')

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://localhost:1234/omnivoice/enroll')
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('http://localhost:1234/omnivoice/synthesize')
    expect(fetchImpl.mock.calls[2]?.[0]).toBe('http://localhost:1234/omnivoice/voices/voice-2')
  })

  it('sends the configured local API key only as a bearer header', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const provider = new HttpVoiceProvider({ baseUrl: 'https://voice.example.test', apiKey: 'local-secret', fetchImpl })

    await provider.synthesize({ providerVoiceId: 'voice-1', text: 'Hello class.' })

    const init = fetchImpl.mock.calls[0]?.[1]
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer local-secret' })
    expect(String(init?.body)).not.toContain('local-secret')
  })
})
