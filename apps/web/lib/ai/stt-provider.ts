export type SttProviderErrorCode =
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'

export class SttProviderError extends Error {
  constructor(
    public readonly code: SttProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'SttProviderError'
  }
}

export interface SttProviderRequest {
  audio: Uint8Array
  mimeType: string
  language?: string
  filename?: string
  signal?: AbortSignal
}

export interface SttResult {
  text: string
  confidence: number | null
}

export interface SttProviderOptions {
  baseUrl: string
  modelId: string
  apiKey?: string
  path?: string
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export class HttpSttProvider {
  private readonly options: Required<
    Pick<SttProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>
  > &
    Omit<SttProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>

  constructor(options: SttProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('STT provider base URL is required')
    if (!options.modelId.trim()) throw new Error('STT provider model ID is required')
    this.options = {
      ...options,
      path: options.path ?? '/audio/transcriptions',
      timeoutMs: options.timeoutMs ?? 30_000,
      maxAttempts: Math.max(1, options.maxAttempts ?? 3),
      baseDelayMs: options.baseDelayMs ?? 250,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? sleep,
    }
  }

  async transcribe(request: SttProviderRequest): Promise<SttResult> {
    if (request.signal?.aborted) throw new SttProviderError('CANCELLED', 'Transcription was cancelled', false)

    let lastError: SttProviderError | undefined
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      try {
        return await this.requestOnce(request)
      } catch (error) {
        const providerError = this.toProviderError(error)
        if (providerError.code === 'CANCELLED' || !providerError.retryable || attempt === this.options.maxAttempts) {
          throw providerError
        }
        lastError = providerError
        await this.options.sleep(this.options.baseDelayMs * 2 ** (attempt - 1))
      }
    }

    throw lastError ?? new SttProviderError('PROVIDER_UNAVAILABLE', 'STT provider unavailable', true)
  }

  private async requestOnce(request: SttProviderRequest): Promise<SttResult> {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new DOMException('The operation timed out', 'TimeoutError')),
      this.options.timeoutMs,
    )
    const abortCaller = () => controller.abort(new DOMException('The operation was cancelled', 'AbortError'))
    request.signal?.addEventListener('abort', abortCaller, { once: true })

    try {
      const body = new FormData()
      body.append('file', new Blob([request.audio], { type: request.mimeType }), request.filename ?? 'speech.webm')
      body.append('model', this.options.modelId)
      if (request.language) body.append('language', request.language)

      const response = await this.options.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}${this.options.path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body,
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status >= 500) {
          throw new SttProviderError('PROVIDER_UNAVAILABLE', 'STT provider is unavailable', true, response.status)
        }
        throw new SttProviderError('PROVIDER_REJECTED', 'STT provider rejected the request', false, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new SttProviderError('INVALID_RESPONSE', 'STT provider returned invalid JSON', false)
      }

      return this.normalizeResponse(payload)
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abortCaller)
    }
  }

  private normalizeResponse(payload: unknown): SttResult {
    if (!payload || typeof payload !== 'object') {
      throw new SttProviderError('INVALID_RESPONSE', 'STT provider returned an invalid response', false)
    }

    const value = payload as Record<string, unknown>
    if (typeof value.text !== 'string' || !value.text.trim()) {
      throw new SttProviderError('INVALID_RESPONSE', 'STT provider returned no transcript', false)
    }

    const confidence = value.confidence
    if (confidence !== undefined && (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      throw new SttProviderError('INVALID_RESPONSE', 'STT provider returned invalid confidence', false)
    }

    return { text: value.text.trim(), confidence: (confidence as number | undefined) ?? null }
  }

  private toProviderError(error: unknown) {
    if (error instanceof SttProviderError) return error
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return new SttProviderError('TIMEOUT', 'STT provider timed out', true)
    }
    if (isAbortError(error)) return new SttProviderError('CANCELLED', 'Transcription was cancelled', false)
    return new SttProviderError('NETWORK_ERROR', 'Could not reach STT provider', true)
  }
}
