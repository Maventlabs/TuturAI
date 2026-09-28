export type PronunciationProviderErrorCode =
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'INVALID_REQUEST'

export class PronunciationProviderError extends Error {
  constructor(
    public readonly code: PronunciationProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'PronunciationProviderError'
  }
}

export interface PronunciationPhoneme {
  phoneme: string
  expected: string
  actual: string | null
  score: number
  confidence: number | null
  startMs: number
  endMs: number
  issue: string | null
}

export interface PronunciationWord {
  word: string
  expected: string
  actual: string
  score: number
  confidence: number | null
  startMs: number
  endMs: number
  phonemes: PronunciationPhoneme[]
}

export interface NormalizedPronunciationResult {
  targetText: string
  transcript: string
  score: number
  confidence: number | null
  feedback: string
  words: PronunciationWord[]
}

export interface PronunciationProviderOptions {
  baseUrl: string
  path: string
  modelId: string
  apiKey?: string
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
}

export interface PronunciationRequest {
  audio: Uint8Array
  mimeType: string
  filename?: string
  expectedText: string
  language?: string
  idempotencyKey: string
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requiredText(value: unknown, name: string, maxLength = 2_000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider ${name} is invalid`, false)
  }
  return value.trim()
}

function score(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider ${name} score is invalid`, false)
  }
  return value
}

function confidence(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider ${name} confidence is invalid`, false)
  }
  return value
}

function timestamp(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider ${name} timestamp is invalid`, false)
  }
  return value
}

function normalizePhoneme(input: unknown, index: number): PronunciationPhoneme {
  if (!isRecord(input)) throw new PronunciationProviderError('INVALID_RESPONSE', `Provider phoneme ${index} is invalid`, false)
  const startMs = timestamp(input.start_ms, `phoneme ${index} start`)
  const endMs = timestamp(input.end_ms, `phoneme ${index} end`)
  if (endMs < startMs) throw new PronunciationProviderError('INVALID_RESPONSE', `Provider phoneme ${index} time range is invalid`, false)
  const actual = input.actual
  if (actual !== null && actual !== undefined && typeof actual !== 'string') {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider phoneme ${index} actual value is invalid`, false)
  }
  const issue = input.issue
  if (issue !== null && issue !== undefined && (typeof issue !== 'string' || issue.length > 64)) {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider phoneme ${index} issue is invalid`, false)
  }
  return {
    phoneme: requiredText(input.phoneme, `phoneme ${index} symbol`, 32),
    expected: requiredText(input.expected, `phoneme ${index} expected value`, 32),
    actual: typeof actual === 'string' ? actual.slice(0, 32) : null,
    score: score(input.score, `phoneme ${index}`),
    confidence: confidence(input.confidence, `phoneme ${index}`),
    startMs,
    endMs,
    issue: typeof issue === 'string' ? issue : null,
  }
}

function normalizeWord(input: unknown, index: number): PronunciationWord {
  if (!isRecord(input) || !Array.isArray(input.phonemes) || input.phonemes.length === 0 || input.phonemes.length > 100) {
    throw new PronunciationProviderError('INVALID_RESPONSE', `Provider word ${index} has no valid phoneme alignment`, false)
  }
  const startMs = timestamp(input.start_ms, `word ${index} start`)
  const endMs = timestamp(input.end_ms, `word ${index} end`)
  if (endMs < startMs) throw new PronunciationProviderError('INVALID_RESPONSE', `Provider word ${index} time range is invalid`, false)
  return {
    word: requiredText(input.word, `word ${index}`, 128),
    expected: requiredText(input.expected, `word ${index} expected value`, 128),
    actual: requiredText(input.actual, `word ${index} actual value`, 128),
    score: score(input.score, `word ${index}`),
    confidence: confidence(input.confidence, `word ${index}`),
    startMs,
    endMs,
    phonemes: input.phonemes.map(normalizePhoneme),
  }
}

export function normalizePronunciationResult(input: unknown, targetText: string): NormalizedPronunciationResult {
  if (!isRecord(input) || !Array.isArray(input.words) || input.words.length === 0 || input.words.length > 250) {
    throw new PronunciationProviderError('INVALID_RESPONSE', 'Provider returned no valid word alignment', false)
  }
  const words = input.words.map(normalizeWord)
  return {
    targetText: requiredText(targetText, 'target text'),
    transcript: requiredText(input.transcript, 'transcript'),
    score: Math.round(words.reduce((total, word) => total + word.score, 0) / words.length),
    confidence: confidence(input.confidence, 'alignment'),
    feedback: requiredText(input.feedback, 'feedback', 1_000),
    words,
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

export class HttpPronunciationProvider {
  private readonly options: Required<Pick<PronunciationProviderOptions, 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>> & PronunciationProviderOptions

  constructor(options: PronunciationProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('Pronunciation provider base URL is required')
    if (!options.path.trim() || !options.path.startsWith('/')) throw new Error('Pronunciation provider path must be configured')
    if (!options.modelId.trim()) throw new Error('Pronunciation provider model ID is required')
    this.options = {
      ...options,
      timeoutMs: options.timeoutMs ?? 30_000,
      maxAttempts: Math.max(1, options.maxAttempts ?? 2),
      baseDelayMs: options.baseDelayMs ?? 300,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? sleep,
    }
  }

  async align(request: PronunciationRequest): Promise<NormalizedPronunciationResult> {
    if (!request.audio.byteLength || request.audio.byteLength > 10 * 1024 * 1024) {
      throw new PronunciationProviderError('INVALID_REQUEST', 'Pronunciation audio size is invalid', false)
    }
    if (!request.expectedText.trim() || !request.idempotencyKey.trim()) {
      throw new PronunciationProviderError('INVALID_REQUEST', 'Expected text and Idempotency-Key are required', false)
    }

    let lastError: PronunciationProviderError | undefined
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
    throw lastError ?? new PronunciationProviderError('PROVIDER_UNAVAILABLE', 'Pronunciation provider is unavailable', true)
  }

  private async requestOnce(request: PronunciationRequest) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(new DOMException('The operation timed out', 'TimeoutError')), this.options.timeoutMs)
    const abortCaller = () => controller.abort(new DOMException('The operation was cancelled', 'AbortError'))
    request.signal?.addEventListener('abort', abortCaller, { once: true })
    try {
      const form = new FormData()
      form.append('audio', new Blob([request.audio], { type: request.mimeType }), request.filename ?? 'pronunciation.wav')
      form.append('model', this.options.modelId)
      form.append('expected_text', request.expectedText.trim())
      form.append('language', request.language ?? 'en')
      const response = await this.options.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}${this.options.path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Idempotency-Key': request.idempotencyKey,
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: form,
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status >= 500) throw new PronunciationProviderError('PROVIDER_UNAVAILABLE', 'Pronunciation provider is unavailable', true, response.status)
        throw new PronunciationProviderError('PROVIDER_REJECTED', 'Pronunciation provider rejected the request', false, response.status)
      }
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new PronunciationProviderError('INVALID_RESPONSE', 'Pronunciation provider returned invalid JSON', false, response.status)
      }
      if (isRecord(payload) && 'data' in payload) payload = payload.data
      return normalizePronunciationResult(payload, request.expectedText)
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abortCaller)
    }
  }

  private toProviderError(error: unknown) {
    if (error instanceof PronunciationProviderError) return error
    if (error instanceof DOMException && error.name === 'TimeoutError') return new PronunciationProviderError('TIMEOUT', 'Pronunciation provider timed out', true)
    if (error instanceof DOMException && error.name === 'AbortError') return new PronunciationProviderError('CANCELLED', 'Pronunciation was cancelled', false)
    return new PronunciationProviderError('NETWORK_ERROR', 'Could not reach pronunciation provider', true)
  }
}
