import { VoiceProviderError, type VoiceSynthesisResult } from './voice-provider'

/**
 * Gemini's speech models are not OpenAI-compatible: they answer on
 * `:generateContent` with base64 audio inside the JSON body instead of
 * streaming an audio response. This provider speaks that native protocol.
 */
export interface GeminiTtsProviderOptions {
  baseUrl: string
  apiKey?: string
  modelId?: string
  voiceName?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_VOICE_NAME = 'Kore'

const GEMINI_PREBUILT_VOICES = new Set([
  'achernar', 'achird', 'algenib', 'algieba', 'alnilam', 'aoede', 'autonoe', 'callirrhoe',
  'charon', 'despina', 'enceladus', 'erinome', 'fenrir', 'gacrux', 'iapetus', 'kore',
  'laomedeia', 'leda', 'orus', 'pulcherrima', 'puck', 'rasalgethi', 'sadachbia',
  'sadaltager', 'schedar', 'sulafat', 'umbriel', 'vindemiatrix', 'zephyr', 'zubenelgenubi',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function isGeminiTtsBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false
  try {
    return new URL(baseUrl).hostname.endsWith('generativelanguage.googleapis.com')
  } catch {
    return false
  }
}

/**
 * Gemini cannot clone a voice, so a cloned provider voice id has no meaning
 * there. A profile that names one of the prebuilt voices is honoured; anything
 * else falls back to the configured default voice.
 */
export function resolveGeminiVoiceName(providerVoiceId: string, fallback = DEFAULT_VOICE_NAME): string {
  const candidate = providerVoiceId.trim()
  return GEMINI_PREBUILT_VOICES.has(candidate.toLowerCase()) ? candidate : fallback
}

function generateContentUrl(baseUrl: string, modelId: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const root = /\/(v1beta|v1)$/.test(trimmed) ? trimmed : `${trimmed}/v1beta`
  return `${root}/models/${encodeURIComponent(modelId)}:generateContent`
}

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'))
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
}

/**
 * Gemini returns raw 16-bit PCM for some models (`audio/l16; rate=24000`),
 * which no browser can play on its own. Wrapping it in a WAV container keeps
 * the response playable by the same <audio> element that plays MP3.
 */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels: number, bitsPerSample = 16): ArrayBuffer {
  const blockAlign = (channels * bitsPerSample) / 8
  const buffer = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Uint8Array(buffer, 44).set(pcm)

  return buffer
}

function parsePcmMimeType(mimeType: string): { sampleRate: number; channels: number } {
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1])
  const channels = Number(/channels=(\d+)/i.exec(mimeType)?.[1])
  return {
    sampleRate: Number.isFinite(rate) && rate > 0 ? rate : 24_000,
    channels: Number.isFinite(channels) && channels > 0 ? channels : 1,
  }
}

function toPlayableAudio(inlineData: { mimeType?: unknown; data?: unknown }): VoiceSynthesisResult {
  const mimeType = typeof inlineData.mimeType === 'string' ? inlineData.mimeType : ''
  const data = typeof inlineData.data === 'string' ? inlineData.data : ''
  if (!data) throw new VoiceProviderError('INVALID_RESPONSE', 'Gemini TTS returned no audio', false)

  const bytes = decodeBase64(data)
  if (bytes.byteLength === 0) throw new VoiceProviderError('INVALID_RESPONSE', 'Gemini TTS returned empty audio', false)

  if (/audio\/(wav|x-wav|wave|mpeg|mp3|ogg)/i.test(mimeType)) {
    return { audio: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, contentType: mimeType.split(';')[0].trim() }
  }

  const { sampleRate, channels } = parsePcmMimeType(mimeType)
  return { audio: pcmToWav(bytes, sampleRate, channels), contentType: 'audio/wav' }
}

export class GeminiTtsProvider {
  private readonly options: Required<Pick<GeminiTtsProviderOptions, 'timeoutMs' | 'fetchImpl'>> & GeminiTtsProviderOptions

  constructor(options: GeminiTtsProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('Voice provider base URL is required')
    this.options = {
      ...options,
      timeoutMs: options.timeoutMs ?? 60_000,
      fetchImpl: options.fetchImpl ?? fetch,
    }
  }

  async synthesize(input: { providerVoiceId: string; text: string }): Promise<VoiceSynthesisResult> {
    const text = input.text.trim()
    if (!text) throw new VoiceProviderError('INVALID_REQUEST', 'Text is required', false)
    if (!this.options.modelId) {
      throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'No Gemini TTS model is configured', true)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    try {
      const response = await this.options.fetchImpl(generateContentUrl(this.options.baseUrl, this.options.modelId), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.options.apiKey ? { 'x-goog-api-key': this.options.apiKey } : {}),
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: resolveGeminiVoiceName(input.providerVoiceId, this.options.voiceName ?? DEFAULT_VOICE_NAME),
                },
              },
            },
          },
        }),
        signal: controller.signal,
      })

      if (response.status === 429 || response.status >= 500) {
        throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Gemini TTS is unavailable', true, response.status)
      }
      if (!response.ok) {
        throw new VoiceProviderError('PROVIDER_REJECTED', 'Gemini TTS rejected the request', false, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new VoiceProviderError('INVALID_RESPONSE', 'Gemini TTS returned invalid JSON', false, response.status)
      }

      const parts = isRecord(payload) && Array.isArray(payload.candidates)
        ? (payload.candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts
        : undefined
      const inlineData = Array.isArray(parts)
        ? parts.map((part) => (isRecord(part) ? part.inlineData : undefined)).find(isRecord)
        : undefined

      if (!inlineData) throw new VoiceProviderError('INVALID_RESPONSE', 'Gemini TTS returned no audio', false, response.status)
      return toPlayableAudio(inlineData)
    } catch (error) {
      if (error instanceof VoiceProviderError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw new VoiceProviderError('TIMEOUT', 'Gemini TTS timed out', true)
      throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Could not reach Gemini TTS', true)
    } finally {
      clearTimeout(timeout)
    }
  }
}
