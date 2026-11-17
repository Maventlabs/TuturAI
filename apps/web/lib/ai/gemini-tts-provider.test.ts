import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiTtsProvider, isGeminiTtsBaseUrl, pcmToWav, resolveGeminiVoiceName } from './gemini-tts-provider'
import { VoiceProviderError } from './voice-provider'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

function audioPayload(mimeType: string, bytes: number[]) {
  return {
    candidates: [{ content: { parts: [{ inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } }] } }],
  }
}

function provider(fetchImpl: ReturnType<typeof vi.fn>, overrides: Partial<ConstructorParameters<typeof GeminiTtsProvider>[0]> = {}) {
  return new GeminiTtsProvider({
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: 'gemini-key',
    modelId: 'gemini-3.8-flash-tts',
    fetchImpl,
    ...overrides,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isGeminiTtsBaseUrl', () => {
  it('recognises the native Gemini host', () => {
    expect(isGeminiTtsBaseUrl('https://generativelanguage.googleapis.com')).toBe(true)
    expect(isGeminiTtsBaseUrl('https://tts.example.test/v1')).toBe(false)
    expect(isGeminiTtsBaseUrl(undefined)).toBe(false)
  })
})

describe('resolveGeminiVoiceName', () => {
  it('keeps a prebuilt voice named by the profile', () => {
    expect(resolveGeminiVoiceName('Puck', 'Kore')).toBe('Puck')
    expect(resolveGeminiVoiceName('kore', 'Puck')).toBe('kore')
  })

  it('falls back for a cloned voice id Gemini cannot use', () => {
    expect(resolveGeminiVoiceName('omnivoice-clone-abc123', 'Kore')).toBe('Kore')
  })
})

describe('pcmToWav', () => {
  it('wraps raw PCM in a playable WAV container', () => {
    const wav = pcmToWav(new Uint8Array([1, 2, 3, 4]), 24_000, 1)
    const view = new DataView(wav)

    expect(String.fromCharCode(...new Uint8Array(wav, 0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...new Uint8Array(wav, 8, 4))).toBe('WAVE')
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(40, true)).toBe(4)
    expect(wav.byteLength).toBe(48)
  })
})

describe('GeminiTtsProvider', () => {
  it('calls the native generateContent endpoint with the audio modality', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(audioPayload('audio/wav', [1, 2, 3])))

    const result = await provider(fetchImpl).synthesize({ providerVoiceId: 'clone-1', text: 'halo' })

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent',
    )
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('gemini-key')
    const body = JSON.parse(String(init.body))
    expect(body.contents[0].parts[0].text).toBe('halo')
    expect(body.generationConfig.responseModalities).toEqual(['AUDIO'])
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore')
    expect(result.contentType).toBe('audio/wav')
    expect(result.audio.byteLength).toBe(3)
  })

  it('converts raw PCM responses into WAV audio', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(audioPayload('audio/l16; rate=24000; channels=1', [1, 2, 3, 4])))

    const result = await provider(fetchImpl).synthesize({ providerVoiceId: 'clone-1', text: 'halo' })

    expect(result.contentType).toBe('audio/wav')
    expect(String.fromCharCode(...new Uint8Array(result.audio, 0, 4))).toBe('RIFF')
    expect(result.audio.byteLength).toBe(48)
  })

  it('honours a prebuilt voice name from the profile', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(audioPayload('audio/wav', [1])))

    await provider(fetchImpl).synthesize({ providerVoiceId: 'Puck', text: 'halo' })

    const body = JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body))
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck')
  })

  it('treats a server error as retryable so failover can move on', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ error: { message: 'boom' } }, 500))

    await expect(provider(fetchImpl).synthesize({ providerVoiceId: 'clone-1', text: 'halo' }))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: true })
  })

  it('treats a rejected request as non-retryable', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ error: { message: 'bad voice' } }, 400))

    const failure = await provider(fetchImpl).synthesize({ providerVoiceId: 'clone-1', text: 'halo' }).catch((error) => error)

    expect(failure).toBeInstanceOf(VoiceProviderError)
    expect(failure).toMatchObject({ code: 'PROVIDER_REJECTED', retryable: false })
  })

  it('rejects a response without audio', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ candidates: [{ content: { parts: [{ text: 'nope' }] } }] }))

    await expect(provider(fetchImpl).synthesize({ providerVoiceId: 'clone-1', text: 'halo' }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
