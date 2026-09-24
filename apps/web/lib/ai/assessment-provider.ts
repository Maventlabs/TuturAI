import { normalizeAssessment, type AssessmentMode, type NormalizedAssessment } from '@tuturai/domain'

export type AssessmentProviderErrorCode =
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'

export class AssessmentProviderError extends Error {
  constructor(
    public readonly code: AssessmentProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'AssessmentProviderError'
  }
}

export interface AssessmentProviderRequest {
  audio: Uint8Array
  mimeType: string
  filename?: string
  language?: string
  transcript?: string
  mode?: AssessmentMode
  expectedText?: string
  signal?: AbortSignal
}

export interface AssessmentProviderOptions {
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

export class HttpAssessmentProvider {
  private readonly options: Required<Pick<AssessmentProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>> & Omit<AssessmentProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>

  constructor(options: AssessmentProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('AI provider base URL is required')
    if (!options.modelId.trim()) throw new Error('AI provider model ID is required')
    this.options = {
      ...options,
      path: options.path ?? '/chat/completions',
      timeoutMs: options.timeoutMs ?? 30_000,
      maxAttempts: Math.max(1, options.maxAttempts ?? 3),
      baseDelayMs: options.baseDelayMs ?? 250,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? sleep,
    }
  }

  async assess(request: AssessmentProviderRequest): Promise<NormalizedAssessment> {
    if (request.signal?.aborted) throw new AssessmentProviderError('CANCELLED', 'Assessment was cancelled', false)

    let lastError: AssessmentProviderError | undefined
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      try {
        return await this.requestOnce(request)
      } catch (error) {
        const providerError = this.toProviderError(error)
        if (providerError.code === 'CANCELLED' || !providerError.retryable || attempt === this.options.maxAttempts) throw providerError
        lastError = providerError
        await this.options.sleep(this.options.baseDelayMs * 2 ** (attempt - 1))
      }
    }

    throw lastError ?? new AssessmentProviderError('PROVIDER_UNAVAILABLE', 'Assessment provider unavailable', true)
  }

  private async requestOnce(request: AssessmentProviderRequest) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(new DOMException('The operation timed out', 'TimeoutError')), this.options.timeoutMs)
    const abortCaller = () => controller.abort(new DOMException('The operation was cancelled', 'AbortError'))
    request.signal?.addEventListener('abort', abortCaller, { once: true })

    try {
      const response = await this.options.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}${this.options.path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.options.modelId,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                 `Return JSON only with pronunciation, fluency, intonation, grammar, vocabulary, overall, transcript, feedback, and confidence. Scores must be numbers from 0 to 100. Confidence must be a number from 0 to 1. The assessment mode is ${request.mode ?? 'speaking'}. For pronunciation, compare the transcript with the expected text and prioritize pronunciation accuracy. For conversation, evaluate relevance, grammar, vocabulary, fluency, and intonation. Do not invent an overall score; the server recalculates it.`,
            },
            {
              role: 'user',
              content: `Assess this ${request.mode ?? 'speaking'} transcript in ${request.language ?? 'English'}. Expected text: ${request.expectedText ?? 'not provided'}. Transcript: ${request.transcript ?? ''}`,
            },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status >= 500) throw new AssessmentProviderError('PROVIDER_UNAVAILABLE', 'Assessment provider is unavailable', true, response.status)
        throw new AssessmentProviderError('PROVIDER_REJECTED', 'Assessment provider rejected the request', false, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new AssessmentProviderError('INVALID_RESPONSE', 'Assessment provider returned invalid JSON', false)
      }

      const content = this.extractContent(payload)
      const normalized = normalizeAssessment(content)
      if (!normalized.success) throw new AssessmentProviderError('INVALID_RESPONSE', 'Assessment provider returned an invalid assessment', false)
      return normalized.data
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abortCaller)
    }
  }

  private extractContent(payload: unknown) {
    if (!payload || typeof payload !== 'object') return payload
    const value = payload as Record<string, unknown>
    if (!Array.isArray(value.choices)) return payload

    const first = value.choices[0]
    if (!first || typeof first !== 'object') return null
    const message = (first as Record<string, unknown>).message
    if (!message || typeof message !== 'object') return null
    const content = (message as Record<string, unknown>).content
    if (typeof content !== 'string') return null

    const json = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    try {
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  private toProviderError(error: unknown) {
    if (error instanceof AssessmentProviderError) return error
    if (error instanceof DOMException && error.name === 'TimeoutError') return new AssessmentProviderError('TIMEOUT', 'Assessment provider timed out', true)
    if (isAbortError(error)) return new AssessmentProviderError('CANCELLED', 'Assessment was cancelled', false)
    if (isTimeoutError(error)) return new AssessmentProviderError('TIMEOUT', 'Assessment provider timed out', true)
    return new AssessmentProviderError('NETWORK_ERROR', 'Could not reach assessment provider', true)
  }
}
