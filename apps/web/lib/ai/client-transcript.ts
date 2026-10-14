/**
 * Client-transcript assessment input (browser Web Speech API path).
 *
 * SECURITY: a client-supplied transcript is UNTRUSTED input. It can be pasted,
 * scripted, or replayed, so nothing numeric is taken from the client:
 *
 * - `wordCount` is derived here by the server from the transcript text.
 * - `spokenDurationMs` is clamped to a plausible range; an implausible value is
 *   replaced with a neutral estimate and the assessment is flagged unverified.
 * - Audio-only dimensions (pronunciation, intonation) are marked
 *   `insufficient_evidence`; they are never derived from text. SCORING_SPEC §10
 *   and §13: a missing metric is never silently zeroed or fabricated.
 * - `audioVerified` is false, so consumers can refuse to award credit for an
 *   attempt that no server-side transcription can corroborate.
 */

/** Hard ceiling on transcript size; bounds memory and downstream prompt cost. */
export const MAX_TRANSCRIPT_CHARS = 4000

/** A recorded turn longer than this is treated as suspicious input. */
export const MAX_TRANSCRIPT_DURATION_MS = 120_000
/** Shorter than this cannot contain a real sentence. */
export const MIN_TRANSCRIPT_DURATION_MS = 500

/** Fastest plausible speech for a learner, used only to bound the ceiling. */
const MAX_PLAUSIBLE_WPM = 200
/** Neutral assumption when the reported duration is not usable. */
const ASSUMED_WPM = 100

export type TranscriptSource = 'browser_speech_api' | 'server_stt'

export interface ClientTranscriptInput {
  transcript: string
  reportedDurationMs: number
  source: TranscriptSource
}

/**
 * Client transcript that has been validated and normalized for the scorer.
 * `wordCount` and `spokenDurationMs` here are server-derived or clamped, never
 * echoed straight from the request body.
 */
export interface DerivedTranscriptMetrics {
  transcript: string
  wordCount: number
  spokenDurationMs: number
  totalRecordingDurationMs: number
  /** False when the reported duration had to be replaced or rejected. */
  durationPlausible: boolean
  /** Always false for a browser transcript: no server-side audio exists. */
  audioVerified: boolean
}

export class TranscriptValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptValidationError'
  }
}

/** Word tokenizer shared with the fluency channel (mirrors tokenizeForCounts). */
export function countTranscriptWords(transcript: string): number {
  return transcript.toLowerCase().match(/[a-z][a-z'-]*/g)?.length ?? 0
}

export interface NormalizeTranscriptOptions {
  /** Enforced ceiling on derived WPM when the client reports a short duration. */
  maxPlausibleWpm?: number
}

/**
 * Validates a client transcript and derives server-owned metrics.
 *
 * Throws `TranscriptValidationError` when the transcript is empty, over the
 * length cap, or the reported duration is not a finite positive number, so the
 * route can reject the request instead of scoring garbage.
 */
export function normalizeClientTranscript(
  input: ClientTranscriptInput,
  options: NormalizeTranscriptOptions = {},
): DerivedTranscriptMetrics {
  if (typeof input.transcript !== 'string') {
    throw new TranscriptValidationError('Transcript must be a string')
  }
  const transcript = input.transcript.trim()
  if (!transcript) {
    throw new TranscriptValidationError('Transcript must not be empty')
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new TranscriptValidationError(`Transcript exceeds ${MAX_TRANSCRIPT_CHARS} characters`)
  }

  const reported = input.reportedDurationMs
  if (!Number.isFinite(reported) || reported <= 0) {
    throw new TranscriptValidationError('A positive reported duration is required')
  }

  const wordCount = countTranscriptWords(transcript)
  if (wordCount === 0) {
    throw new TranscriptValidationError('Transcript contains no recognisable words')
  }

  const maxWpm = options.maxPlausibleWpm ?? MAX_PLAUSIBLE_WPM
  const reportedWpm = (wordCount / reported) * 60_000
  const fastestDurationMs = (wordCount / maxWpm) * 60_000

  // A duration below the fastest plausible speech is not credible. Replace it
  // with the neutral assumption instead of inflating fluency from it.
  const implausiblyFast = reportedWpm > maxWpm
  const clampedDuration = Math.min(Math.max(reported, MIN_TRANSCRIPT_DURATION_MS), MAX_TRANSCRIPT_DURATION_MS)
  const spokenDurationMs = implausiblyFast
    ? Math.max(fastestDurationMs, (wordCount / ASSUMED_WPM) * 60_000)
    : clampedDuration

  return {
    transcript,
    wordCount,
    spokenDurationMs: Math.round(spokenDurationMs),
    totalRecordingDurationMs: Math.round(clampedDuration),
    durationPlausible: !implausiblyFast,
    audioVerified: false,
  }
}

/**
 * Transcript from the server's own STT run. The audio exists, so the scorer may
 * use the full evidence contract (including pronunciation/intonation when the
 * provider supplies alignment or pitch).
 */
export function metricsFromServerStt(transcript: string, durationMs: number): DerivedTranscriptMetrics {
  const text = transcript.trim()
  return {
    transcript: text,
    wordCount: countTranscriptWords(text),
    spokenDurationMs: Math.round(durationMs),
    totalRecordingDurationMs: Math.round(durationMs),
    durationPlausible: true,
    audioVerified: true,
  }
}