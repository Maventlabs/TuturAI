export type VoiceProviderErrorCode = 'INVALID_REQUEST' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_REJECTED' | 'INVALID_RESPONSE' | 'TIMEOUT'

export class VoiceProviderError extends Error {
  constructor(
    public readonly code: VoiceProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'VoiceProviderError'
  }
}

export interface VoiceProviderOptions {
  baseUrl: string
  apiKey?: string
  modelId?: string
  enrollmentPath?: string
  synthesisPath?: string
  deletePath?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export interface VoiceEnrollmentRequest {
  audio: Uint8Array
  mimeType: string
  filename?: string
  referenceText: string
}

export interface VoiceEnrollmentResult {
  providerVoiceId: string
  status: 'processing' | 'ready'
}

export interface VoiceSynthesisResult {
  audio: ArrayBuffer
  contentType: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export class HttpVoiceProvider {
  private readonly options: Required<Pick<VoiceProviderOptions, 'enrollmentPath' | 'synthesisPath' | 'deletePath' | 'timeoutMs' | 'fetchImpl'>> & Omit<VoiceProviderOptions, 'enrollmentPath' | 'synthesisPath' | 'deletePath' | 'timeoutMs' | 'fetchImpl'>

  constructor(options: VoiceProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('Voice provider base URL is required')
    this.options = {
      ...options,
      enrollmentPath: options.enrollmentPath ?? '/v1/voice-clones',
      synthesisPath: options.synthesisPath ?? '/v1/audio/speech',
      deletePath: options.deletePath ?? '/v1/voice-clones',
      timeoutMs: options.timeoutMs ?? 60_000,
      fetchImpl: options.fetchImpl ?? fetch,
    }
  }

  async enroll(request: VoiceEnrollmentRequest): Promise<VoiceEnrollmentResult> {
    if (request.audio.byteLength === 0) throw new VoiceProviderError('INVALID_REQUEST', 'Reference audio is required', false)
    if (!request.referenceText.trim()) throw new VoiceProviderError('INVALID_REQUEST', 'Reference transcript is required', false)

    const form = new FormData()
    form.append('audio', new Blob([request.audio], { type: request.mimeType }), request.filename ?? 'reference-audio')
    form.append('ref_text', request.referenceText.trim())
    return this.requestJson<VoiceEnrollmentResult>(this.options.enrollmentPath, { method: 'POST', body: form }, (payload) => {
      if (!isRecord(payload) || typeof payload.id !== 'string' || !['processing', 'ready'].includes(String(payload.status))) return null
      return { providerVoiceId: payload.id, status: payload.status as VoiceEnrollmentResult['status'] }
    })
  }

  async delete(providerVoiceId: string): Promise<void> {
    if (!providerVoiceId.trim()) throw new VoiceProviderError('INVALID_REQUEST', 'Provider voice id is required', false)
    await this.requestNoContent(`${this.options.deletePath}/${encodeURIComponent(providerVoiceId)}`, { method: 'DELETE' })
  }

  async synthesize(input: { providerVoiceId: string; text: string }): Promise<VoiceSynthesisResult> {
    if (!input.providerVoiceId.trim() || !input.text.trim()) throw new VoiceProviderError('INVALID_REQUEST', 'Voice id and text are required', false)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    try {
      const response = await this.options.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}${this.options.synthesisPath}`, {
        method: 'POST',
        headers: {
          Accept: 'audio/*',
          'Content-Type': 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({ voice_id: input.providerVoiceId, input: input.text.trim(), ...(this.options.modelId ? { model: this.options.modelId } : {}) }),
        signal: controller.signal,
      })
      if (response.status >= 500) throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Voice provider is unavailable', true, response.status)
      if (!response.ok) throw new VoiceProviderError('PROVIDER_REJECTED', 'Voice provider rejected the request', false, response.status)
      const audio = await response.arrayBuffer()
      if (audio.byteLength === 0) throw new VoiceProviderError('INVALID_RESPONSE', 'Voice provider returned empty audio', false, response.status)
      return { audio, contentType: response.headers.get('content-type') ?? 'audio/mpeg' }
    } catch (error) {
      if (error instanceof VoiceProviderError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw new VoiceProviderError('TIMEOUT', 'Voice provider timed out', true)
      throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Could not reach voice provider', true)
    } finally {
      clearTimeout(timeout)
    }
  }

  private async requestNoContent(path: string, init: RequestInit): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    try {
      const response = await this.options.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      })
      if (response.status >= 500) throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Voice provider is unavailable', true, response.status)
      if (!response.ok) throw new VoiceProviderError('PROVIDER_REJECTED', 'Voice provider rejected the request', false, response.status)
    } catch (error) {
      if (error instanceof VoiceProviderError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw new VoiceProviderError('TIMEOUT', 'Voice provider timed out', true)
      throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Could not reach voice provider', true)
    } finally {
      clearTimeout(timeout)
    }
  }

  private async requestJson<T>(path: string, init: RequestInit, parse: (payload: unknown) => T | null): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    try {
      const response = await this.options.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      })
      if (response.status >= 500) throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Voice provider is unavailable', true, response.status)
      if (!response.ok) throw new VoiceProviderError('PROVIDER_REJECTED', 'Voice provider rejected the request', false, response.status)
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new VoiceProviderError('INVALID_RESPONSE', 'Voice provider returned invalid JSON', false, response.status)
      }
      const parsed = parse(payload)
      if (!parsed) throw new VoiceProviderError('INVALID_RESPONSE', 'Voice provider returned an invalid voice profile', false, response.status)
      return parsed
    } catch (error) {
      if (error instanceof VoiceProviderError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw new VoiceProviderError('TIMEOUT', 'Voice provider timed out', true)
      throw new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Could not reach voice provider', true)
    } finally {
      clearTimeout(timeout)
    }
  }
}
