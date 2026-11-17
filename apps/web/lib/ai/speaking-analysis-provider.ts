/**
 * TuturAI language-analysis provider for Speaking Practice.
 *
 * The LLM reads the transcript and the scenario context and returns structured
 * findings only: grammar errors with a severity, corrections, vocabulary notes,
 * task relevance, coherence, and coaching text. It never returns a score — the
 * canonical scoring engine in `@tuturai/domain` owns every number, so a model
 * change can never move a student's grade.
 */

export type SpeakingAnalysisErrorCode =
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'

export class SpeakingAnalysisError extends Error {
  constructor(
    public readonly code: SpeakingAnalysisErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'SpeakingAnalysisError'
  }
}

export type GrammarSeverity = 'light' | 'medium' | 'heavy'

export interface SpeakingGrammarFinding {
  category: string
  severity: GrammarSeverity
  original?: string
  corrected?: string
  explanation?: string
  confidence?: number
}

export interface SpeakingCorrection {
  original: string
  corrected: string
  explanation: string
}

export interface SpeakingAnalysis {
  transcript: string
  grammarFindings: SpeakingGrammarFinding[]
  corrections: SpeakingCorrection[]
  vocabulary: {
    notes: string
    suggestions: string[]
    repeatedWords: string[]
  }
  relevance: {
    onTask: boolean
    comment: string
  }
  coherence: {
    comment: string
  }
  strengths: string[]
  improvements: string[]
  dimensionFeedback: {
    pronunciation: string
    fluency: string
    intonation: string
    grammar: string
    vocabulary: string
  }
  confidence: number | null
  /** Findings the provider returned in a shape the engine cannot score. */
  droppedFindings: number
}

export interface SpeakingAnalysisScenario {
  title: string
  category: string
  difficulty: string
  situation: string
  context: string
  objective: string
  question: string
}

export interface SpeakingAnalysisRequest {
  scenario: SpeakingAnalysisScenario
  practiceMode: 'guided' | 'free'
  sessionType: 'quick' | 'full'
  transcript: string
  durationMs: number
  wordCount: number
  acoustic: {
    wpm: number | null
    pauseRatio: number | null
    meanF0Hz: number | null
    pitchVariationSemitones: number | null
  } | null
  language?: string
  signal?: AbortSignal
}

export interface SpeakingAnalysisProviderOptions {
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

const MAX_FINDINGS = 40
const MAX_LIST_ITEMS = 6
const MAX_TEXT = 600

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, maxLength = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function textList(value: unknown, maxItems = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, 240))
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
}

function severity(value: unknown): GrammarSeverity | null {
  return value === 'light' || value === 'medium' || value === 'heavy' ? value : null
}

function confidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null
  return value
}

export function buildSpeakingAnalysisPrompt(request: SpeakingAnalysisRequest) {
  const acoustic = request.acoustic
  const acousticLine = acoustic
    ? `Measured acoustic evidence: ${acoustic.wpm === null ? 'words per minute unavailable' : `${Math.round(acoustic.wpm)} words per minute`}, pause ratio ${acoustic.pauseRatio === null ? 'unavailable' : acoustic.pauseRatio.toFixed(2)}, mean pitch ${acoustic.meanF0Hz === null ? 'unavailable' : `${acoustic.meanF0Hz} Hz`}, pitch variation ${acoustic.pitchVariationSemitones === null ? 'unavailable' : `${acoustic.pitchVariationSemitones} semitones`}.`
    : 'No acoustic evidence is available for this answer.'

  const system = [
    'You are the language-analysis stage of TuturAI, an English speaking assessment for Indonesian students.',
    'You analyse a transcript only. You cannot hear the audio, so you must never claim to judge pronunciation or intonation quality from the text.',
    'Return JSON only, with exactly these keys:',
    '{"transcript": string, "grammarFindings": [{"category": string, "severity": "light"|"medium"|"heavy", "original": string, "corrected": string, "explanation": string, "confidence": number}], "corrections": [{"original": string, "corrected": string, "explanation": string}], "vocabulary": {"notes": string, "suggestions": string[], "repeatedWords": string[]}, "relevance": {"onTask": boolean, "comment": string}, "coherence": {"comment": string}, "strengths": string[], "improvements": string[], "dimensionFeedback": {"pronunciation": string, "fluency": string, "intonation": string, "grammar": string, "vocabulary": string}, "confidence": number}',
    'Rules:',
    '- Never output a numeric score for any dimension. Scores are computed by a separate deterministic engine.',
    '- severity "light" = minor slip that does not block meaning; "medium" = clear error a listener notices; "heavy" = error that breaks comprehension.',
    '- Only report grammar findings that are actually present in the transcript. Do not invent errors.',
    '- For pronunciation and intonation feedback, describe what the learner should practise in general terms and state that the audio was not analysed. Never assert that a sound was mispronounced.',
    '- Keep every string under 300 characters. Use English. Be specific and encouraging, never generic.',
    '- "improvements" must be actionable and tied to this answer.',
  ].join('\n')

  const user = [
    `Scenario: ${request.scenario.title} (${request.scenario.category}, ${request.scenario.difficulty})`,
    `Situation: ${request.scenario.situation}`,
    `Context: ${request.scenario.context}`,
    `Speaking objective: ${request.scenario.objective}`,
    `Main question: ${request.scenario.question}`,
    `Practice mode: ${request.practiceMode}. Session type: ${request.sessionType}.`,
    `Recording duration: ${Math.round(request.durationMs / 1000)} seconds. Word count: ${request.wordCount}.`,
    acousticLine,
    `Transcript: ${request.transcript}`,
  ].join('\n')

  return { system, user }
}

/** Strict validation of the provider payload. Malformed output fails explicitly. */
export function parseSpeakingAnalysis(payload: unknown, fallbackTranscript: string): SpeakingAnalysis {
  if (!isRecord(payload)) {
    throw new SpeakingAnalysisError('INVALID_RESPONSE', 'Language analysis provider returned an invalid payload', false)
  }
  if (!Array.isArray(payload.grammarFindings)) {
    throw new SpeakingAnalysisError('INVALID_RESPONSE', 'Language analysis provider returned no grammar findings array', false)
  }

  let droppedFindings = 0
  const grammarFindings: SpeakingGrammarFinding[] = []
  for (const item of payload.grammarFindings.slice(0, MAX_FINDINGS)) {
    if (!isRecord(item)) {
      droppedFindings += 1
      continue
    }
    const category = text(item.category, 80)
    const level = severity(item.severity)
    if (!category || !level) {
      droppedFindings += 1
      continue
    }
    const finding: SpeakingGrammarFinding = { category, severity: level }
    const original = text(item.original, 300)
    const corrected = text(item.corrected, 300)
    const explanation = text(item.explanation, 300)
    const score = confidence(item.confidence)
    if (original) finding.original = original
    if (corrected) finding.corrected = corrected
    if (explanation) finding.explanation = explanation
    if (score !== null) finding.confidence = score
    grammarFindings.push(finding)
  }

  const corrections: SpeakingCorrection[] = []
  if (Array.isArray(payload.corrections)) {
    for (const item of payload.corrections.slice(0, MAX_FINDINGS)) {
      if (!isRecord(item)) continue
      const original = text(item.original, 300)
      const corrected = text(item.corrected, 300)
      if (!original || !corrected) continue
      corrections.push({ original, corrected, explanation: text(item.explanation, 300) })
    }
  }

  const vocabulary = isRecord(payload.vocabulary) ? payload.vocabulary : {}
  const relevance = isRecord(payload.relevance) ? payload.relevance : {}
  const coherence = isRecord(payload.coherence) ? payload.coherence : {}
  const dimensionFeedback = isRecord(payload.dimensionFeedback) ? payload.dimensionFeedback : {}

  return {
    transcript: text(payload.transcript, 4000) || fallbackTranscript,
    grammarFindings,
    corrections,
    vocabulary: {
      notes: text(vocabulary.notes),
      suggestions: textList(vocabulary.suggestions),
      repeatedWords: textList(vocabulary.repeatedWords, 8),
    },
    relevance: {
      onTask: relevance.onTask === true,
      comment: text(relevance.comment),
    },
    coherence: { comment: text(coherence.comment) },
    strengths: textList(payload.strengths),
    improvements: textList(payload.improvements),
    dimensionFeedback: {
      pronunciation: text(dimensionFeedback.pronunciation),
      fluency: text(dimensionFeedback.fluency),
      intonation: text(dimensionFeedback.intonation),
      grammar: text(dimensionFeedback.grammar),
      vocabulary: text(dimensionFeedback.vocabulary),
    },
    confidence: confidence(payload.confidence),
    droppedFindings,
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export class HttpSpeakingAnalysisProvider {
  private readonly options: Required<
    Pick<SpeakingAnalysisProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>
  > & Omit<SpeakingAnalysisProviderOptions, 'path' | 'timeoutMs' | 'maxAttempts' | 'baseDelayMs' | 'fetchImpl' | 'sleep'>

  constructor(options: SpeakingAnalysisProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error('AI provider base URL is required')
    if (!options.modelId.trim()) throw new Error('AI provider model ID is required')
    this.options = {
      ...options,
      path: options.path ?? '/chat/completions',
      timeoutMs: options.timeoutMs ?? 45_000,
      maxAttempts: Math.max(1, options.maxAttempts ?? 2),
      baseDelayMs: options.baseDelayMs ?? 300,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? sleep,
    }
  }

  async analyze(request: SpeakingAnalysisRequest): Promise<SpeakingAnalysis> {
    if (request.signal?.aborted) throw new SpeakingAnalysisError('CANCELLED', 'Language analysis was cancelled', false)

    let lastError: SpeakingAnalysisError | undefined
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
    throw lastError ?? new SpeakingAnalysisError('PROVIDER_UNAVAILABLE', 'Language analysis provider unavailable', true)
  }

  private async requestOnce(request: SpeakingAnalysisRequest) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new DOMException('The operation timed out', 'TimeoutError')),
      this.options.timeoutMs,
    )
    const abortCaller = () => controller.abort(new DOMException('The operation was cancelled', 'AbortError'))
    request.signal?.addEventListener('abort', abortCaller, { once: true })
    const prompt = buildSpeakingAnalysisPrompt(request)

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
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status >= 500) {
          throw new SpeakingAnalysisError('PROVIDER_UNAVAILABLE', 'Language analysis provider is unavailable', true, response.status)
        }
        throw new SpeakingAnalysisError('PROVIDER_REJECTED', 'Language analysis provider rejected the request', false, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new SpeakingAnalysisError('INVALID_RESPONSE', 'Language analysis provider returned invalid JSON', false)
      }

      return parseSpeakingAnalysis(this.extractContent(payload), request.transcript)
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abortCaller)
    }
  }

  private extractContent(payload: unknown) {
    if (!isRecord(payload) || !Array.isArray(payload.choices)) return payload
    const first = payload.choices[0]
    if (!isRecord(first) || !isRecord(first.message)) return null
    const content = first.message.content
    if (typeof content !== 'string') return null
    const json = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    try {
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  private toProviderError(error: unknown) {
    if (error instanceof SpeakingAnalysisError) return error
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return new SpeakingAnalysisError('TIMEOUT', 'Language analysis provider timed out', true)
    }
    if (isAbortError(error)) return new SpeakingAnalysisError('CANCELLED', 'Language analysis was cancelled', false)
    return new SpeakingAnalysisError('NETWORK_ERROR', 'Could not reach the language analysis provider', true)
  }
}
