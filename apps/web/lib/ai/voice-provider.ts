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
  statusPath?: string
  synthesisPath?: string
  deletePath?: string
  timeoutMs?: number
  statusMaxAttempts?: number
  baseDelayMs?: number
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
}

export interface VoiceEnrollmentRequest {
  audio: Uint8Array
  mimeType: string
  filename?: string
  referenceText: string
  idempotencyKey?: string
}

export interface VoiceEnrollmentResult {
  providerVoiceId: string | null
  status: 'processing' | 'ready' | 'failed'
  errorCode?: string | null
}

export interface VoiceProviderStatusResult {
  status: 'processing' | 'ready' | 'failed'
  errorCode: string | null
}

export interface VoiceSynthesisResult {
  audio: ArrayBuffer
  contentType: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export class HttpVoiceProvider {
  private readonly options: Required<Pick<VoiceProviderOptions, 'enrollmentPath' | 'statusPath' | 'synthesisPath' | 'deletePath' | 'timeoutMs' | 'statusMaxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>> & Omit<VoiceProviderOptions, 'enrollmentPath' | 'statusPath' | 'synthesisPath' | 'deletePath' | 'timeoutMs' | 'statusMaxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>

  constructor(options: VoiceProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('Voice provider base URL is required')
    this.options = {
      ...options,
      enrollmentPath: options.enrollmentPath ?? '/v1/voice-clones',
      statusPath: options.statusPath ?? options.enrollmentPath ?? '/v1/voice-clones',
      synthesisPath: options.synthesisPath ?? '/v1/audio/speech',
      deletePath: options.deletePath ?? '/v1/voice-clones',
      timeoutMs: options.timeoutMs ?? 60_000,
      statusMaxAttempts: Math.max(1, options.statusMaxAttempts ?? 2),
      baseDelayMs: options.baseDelayMs ?? 250,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    }
  }

  async enroll(request: VoiceEnrollmentRequest): Promise<VoiceEnrollmentResult> {
    if (request.audio.byteLength === 0) throw new VoiceProviderError('INVALID_REQUEST', 'Reference audio is required', false)
    if (!request.referenceText.trim()) throw new VoiceProviderError('INVALID_REQUEST', 'Reference transcript is required', false)

    const form = new FormData()
    form.append('audio', new Blob([request.audio], { type: request.mimeType }), request.filename ?? 'reference-audio')
    form.append('ref_text', request.referenceText.trim())
    return this.requestJson<VoiceEnrollmentResult>(this.options.enrollmentPath, {
      method: 'POST',
      body: form,
      headers: request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : undefined,
    }, (payload) => {
      if (!isRecord(payload) || !['processing', 'ready', 'failed'].includes(String(payload.status))) return null
      const providerVoiceId = typeof payload.id === 'string' && payload.id.trim() ? payload.id : null
      if (payload.status !== 'failed' && !providerVoiceId) return null
      const errorCode = typeof payload.error_code === 'string' && /^[A-Z0-9_]{1,64}$/.test(payload.error_code)
        ? payload.error_code
        : typeof payload.errorCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(payload.errorCode)
          ? payload.errorCode
          : null
      return {
        providerVoiceId,
        status: payload.status as VoiceEnrollmentResult['status'],
        ...(payload.status === 'failed' ? { errorCode: errorCode ?? 'VOICE_ENROLLMENT_FAILED' } : {}),
      }
    })
  }

  async getStatus(providerVoiceId: string): Promise<VoiceProviderStatusResult> {
    if (!providerVoiceId.trim()) throw new VoiceProviderError('INVALID_REQUEST', 'Provider voice id is required', false)
    const path = `${this.options.statusPath.replace(/\/$/, '')}/${encodeURIComponent(providerVoiceId)}`
    let lastError: VoiceProviderError | undefined
    for (let attempt = 1; attempt <= this.options.statusMaxAttempts; attempt += 1) {
      try {
        return await this.requestJson<VoiceProviderStatusResult>(path, { method: 'GET' }, (payload) => {
          if (!isRecord(payload) || !['processing', 'ready', 'failed'].includes(String(payload.status))) return null
          if (typeof payload.id === 'string' && payload.id !== providerVoiceId) return null
          const rawCode = typeof payload.error_code === 'string' ? payload.error_code : payload.errorCode
          const errorCode = typeof rawCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : null
          return { status: payload.status as VoiceProviderStatusResult['status'], errorCode }
        })
      } catch (error) {
        const failure = error instanceof VoiceProviderError
          ? error
          : new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Could not reach voice provider', true)
        if (!failure.retryable || attempt === this.options.statusMaxAttempts) throw failure
        lastError = failure
        await this.options.sleep(this.options.baseDelayMs * 2 ** (attempt - 1))
      }
    }
    throw lastError ?? new VoiceProviderError('PROVIDER_UNAVAILABLE', 'Voice status is unavailable', true)
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
      if (response.status === 404) return
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
