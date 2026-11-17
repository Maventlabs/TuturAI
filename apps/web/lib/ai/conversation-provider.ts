import type { ConversationMessage } from './conversation-prompt'

export type ConversationProviderErrorCode =
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'

export class ConversationProviderError extends Error {
  constructor(
    public readonly code: ConversationProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ConversationProviderError'
  }
}

export interface ConversationProviderOptions {
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

/**
 * OpenAI-compatible chat completions client for the tutor turn. It returns the
 * parsed JSON object and leaves contract validation to the domain layer, so a
 * malformed reply is rejected in one place instead of being half-rendered.
 */
export class HttpConversationProvider {
  private readonly options: Required<
    Pick<ConversationProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>
  > &
    Omit<ConversationProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>

  constructor(options: ConversationProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('Conversation provider base URL is required')
    if (!options.modelId.trim()) throw new Error('Conversation provider model ID is required')
    this.options = {
      ...options,
      path: options.path ?? '/chat/completions',
      timeoutMs: options.timeoutMs ?? 30_000,
      maxAttempts: Math.max(1, options.maxAttempts ?? 2),
      baseDelayMs: options.baseDelayMs ?? 400,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? sleep,
    }
  }

  async complete(messages: ConversationMessage[], signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) throw new ConversationProviderError('CANCELLED', 'Conversation was cancelled', false)

    let lastError: ConversationProviderError | undefined
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      try {
        return await this.requestOnce(messages, signal)
      } catch (error) {
        const providerError = this.toProviderError(error)
        if (providerError.code === 'CANCELLED' || !providerError.retryable || attempt === this.options.maxAttempts) {
          throw providerError
        }
        lastError = providerError
        await this.options.sleep(this.options.baseDelayMs * 2 ** (attempt - 1))
      }
    }

    throw lastError ?? new ConversationProviderError('PROVIDER_UNAVAILABLE', 'Tutor is unavailable', true)
  }

  private async requestOnce(messages: ConversationMessage[], signal?: AbortSignal) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new DOMException('The operation timed out', 'TimeoutError')),
      this.options.timeoutMs,
    )
    const abortCaller = () => controller.abort(new DOMException('The operation was cancelled', 'AbortError'))
    signal?.addEventListener('abort', abortCaller, { once: true })

    try {
      const response = await this.options.fetchImpl(
        `${this.options.baseUrl.replace(/\/$/, '')}${this.options.path}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.options.modelId,
            temperature: 0.6,
            response_format: { type: 'json_object' },
            messages,
          }),
          signal: controller.signal,
        },
      )

      if (response.status === 429) {
        throw new ConversationProviderError('RATE_LIMITED', 'Tutor is busy right now', true, 429)
      }
      if (response.status >= 500) {
        throw new ConversationProviderError('PROVIDER_UNAVAILABLE', 'Tutor is unavailable', true, response.status)
      }
      if (!response.ok) {
        throw new ConversationProviderError('PROVIDER_REJECTED', 'Tutor rejected the request', false, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new ConversationProviderError('INVALID_RESPONSE', 'Tutor returned invalid JSON', false)
      }

      const content = this.extractContent(payload)
      if (content === null) {
        throw new ConversationProviderError('INVALID_RESPONSE', 'Tutor returned no message content', false)
      }
      return content
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abortCaller)
    }
  }

  private extractContent(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') return null
    const value = payload as Record<string, unknown>
    if (!Array.isArray(value.choices)) return null

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
    if (error instanceof ConversationProviderError) return error
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return new ConversationProviderError('TIMEOUT', 'Tutor took too long to answer', true)
    }
    if (isAbortError(error)) return new ConversationProviderError('CANCELLED', 'Conversation was cancelled', false)
    return new ConversationProviderError('NETWORK_ERROR', 'Could not reach the tutor', true)
  }
}
