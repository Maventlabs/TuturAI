// ---------------------------------------------------------------------------
// Provider estimate vs canonical score provenance (SCORING_SPEC.md §13, §14)
// ---------------------------------------------------------------------------

/** Where a persisted dimension score came from. Never conflate the two. Re-exported from types. */
export type { DimensionScoreSource } from './types'

/** Words per minute derived from the audio/transcript pipeline, not guessed by an LLM. */
export function calculateWordsPerMinute(wordCount: number, spokenDurationMs: number): number {
  if (!Number.isFinite(wordCount) || wordCount < 0) {
    throw new Error('Fluency evidence invalid: wordCount must be a non-negative finite number')
  }
  if (!Number.isFinite(spokenDurationMs) || spokenDurationMs <= 0) {
    throw new Error('Fluency evidence invalid: spokenDurationMs must be a positive finite number')
  }
  return (wordCount / spokenDurationMs) * 60_000
}

/**
 * Canonical TuturAI scoring engine — SCORING_SPEC.md contract.
 *
 * Providers/LLMs produce raw structured evidence; this module produces scores.
 * Every formula implemented here must come from SCORING_SPEC.md (source-defined)
 * or an explicitly approved decision recorded in EXECUTION.md. Formulas that the
 * source leaves undefined are NOT invented here; they remain
 * `AWAITING_SCORING_DECISION` in EXECUTION.md.
 */

/**
 * Canonical scoring version. Bump whenever a formula change can alter a student
 * result; never reinterpret historical scores with a new formula (spec §15).
 *
 * 2026.2 — Human Decision Gate finalization (SCORING_SPEC §21, decisions ledger
 * in `scoring-decisions.ts`): PER calibration + accent substitution table
 * (SCORING-003), MATTR vocabulary normalization + CEFR vocab lookup + CEFR
 * estimate banding (SCORING-007/010), intonation formula (SCORING-005),
 * missing-metric/confidence status model (D9). Fluency WPM normalization stays
 * 40..120 (D3); grammar keeps the flat penalty table (D5) — no behavior change
 * for those dimensions, so assessments scored under 2026.1 keep their version.
 */
export const SCORING_VERSION = '2026.2'

/** Canonical five-dimension weights for the full online assessment (spec §3). */
export const SPEAKING_DIMENSION_WEIGHTS = {
  pronunciation: 0.25,
  fluency: 0.2,
  intonation: 0.15,
  grammar: 0.2,
  vocabulary: 0.2,
} as const

export type CanonicalDimension = keyof typeof SPEAKING_DIMENSION_WEIGHTS

export type CanonicalDimensionScores = Record<CanonicalDimension, number>

/** Clamp to the canonical score range. NaN guards to 0; infinities clamp by range (spec §10). */
export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** Generic source normalization with explicit zero-denominator guard (spec §10). */
export function normalizeMetric(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0
  if (max === min) return 0
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/**
 * Canonical weighted aggregation (spec §3).
 *
 * Inputs must already be canonical 0..100 dimension scores. The result is
 * clamped to 0..100 and must be computed only by this engine.
 */
export function calculateWeightedFinalScore(scores: CanonicalDimensionScores): number {
  const w = SPEAKING_DIMENSION_WEIGHTS
  for (const dimension of Object.keys(w) as CanonicalDimension[]) {
    const value = scores[dimension]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Scoring input invalid: ${dimension} must be a finite number`)
    }
  }
  const final =
    w.pronunciation * scores.pronunciation +
    w.fluency * scores.fluency +
    w.intonation * scores.intonation +
    w.grammar * scores.grammar +
    w.vocabulary * scores.vocabulary
  return clampScore(final)
}

// ---------------------------------------------------------------------------
// Fluency (SCORING_SPEC.md §5, SCORING-004)
// ---------------------------------------------------------------------------

/**
 * Source-defined fluency formula:
 *
 *   WPMnorm = clamp((WPM - 40) / (120 - 40), 0, 1)
 *   Rpause  = clamp(total_pause_duration / total_recording_duration, 0, 1)
 *   Sf      = [0.6 * WPMnorm + 0.4 * (1 - Rpause)] * 100
 *
 * The source's preferred learner range (70–110 WPM) conflicts with the explicit
 * normalization bounds (40..120). Per spec §5.2 the explicit formula is used and
 * `FLUENCY_WPM_NORMALIZATION` stays an open decision in EXECUTION.md; switching
 * bounds later is a formula change and requires a new scoring version.
 */
export const FLUENCY_WPM_MIN = 40
export const FLUENCY_WPM_MAX = 120
export const FLUENCY_WPM_WEIGHT = 0.6
export const FLUENCY_PAUSE_WEIGHT = 0.4

export interface FluencyEvidence {
  wpm: number
  totalPauseDurationMs: number
  totalRecordingDurationMs: number
}

export interface FluencyScoreResult {
  score: number
  rawMetrics: {
    wpm: number
    pauseRatio: number
    wpmNorm: number
  }
}

export function calculateFluencyScore(evidence: FluencyEvidence): FluencyScoreResult {
  const { wpm, totalPauseDurationMs, totalRecordingDurationMs } = evidence
  if (!Number.isFinite(wpm)) throw new Error('Fluency evidence invalid: wpm must be a finite number')
  if (!Number.isFinite(totalPauseDurationMs) || totalPauseDurationMs < 0) {
    throw new Error('Fluency evidence invalid: totalPauseDurationMs must be a non-negative finite number')
  }
  if (!Number.isFinite(totalRecordingDurationMs) || totalRecordingDurationMs <= 0) {
    throw new Error('Fluency evidence invalid: totalRecordingDurationMs must be a positive finite number')
  }
  if (totalPauseDurationMs > totalRecordingDurationMs) {
    throw new Error('Fluency evidence invalid: totalPauseDurationMs exceeds totalRecordingDurationMs')
  }

  const wpmNorm = normalizeMetric(wpm, FLUENCY_WPM_MIN, FLUENCY_WPM_MAX)
  const pauseRatio = clampScore((totalPauseDurationMs / totalRecordingDurationMs) * 100) / 100
  const score = clampScore((FLUENCY_WPM_WEIGHT * wpmNorm + FLUENCY_PAUSE_WEIGHT * (1 - pauseRatio)) * 100)

  return { score, rawMetrics: { wpm, pauseRatio, wpmNorm } }
}

// ---------------------------------------------------------------------------
// Grammar (SCORING_SPEC.md §7, SCORING-006)
// ---------------------------------------------------------------------------

/** Canonical severity penalties from the source penalty table (spec §7.1). */
export const GRAMMAR_SEVERITY_PENALTIES = {
  light: 5,
  medium: 10,
  heavy: 15,
} as const

export type GrammarSeverity = keyof typeof GRAMMAR_SEVERITY_PENALTIES

/** Minimum structured finding contract every provider must produce (spec §7.2). */
export interface GrammarFinding {
  category: string
  severity: GrammarSeverity
  original?: string
  corrected?: string
  explanation?: string
  confidence?: number
}

export interface GrammarScoreResult {
  score: number
  /** Preserved for future formula versions (spec §7.3): no length normalization yet. */
  rawMetrics: {
    findingsBySeverity: Record<GrammarSeverity, number>
    totalPenalty: number
    totalFindings: number
  }
}

function isValidGrammarFinding(finding: unknown): finding is GrammarFinding {
  if (!finding || typeof finding !== 'object') return false
  const candidate = finding as Record<string, unknown>
  if (typeof candidate.category !== 'string' || !candidate.category.trim()) return false
  if (candidate.severity !== 'light' && candidate.severity !== 'medium' && candidate.severity !== 'heavy') return false
  if (
    candidate.confidence !== undefined
    && (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)
  ) {
    return false
  }
  return true
}

/**
 * Canonical grammar score. The engine — not the provider/LLM — applies the
 * penalty table. Input is untrusted provider output; malformed findings fail
 * explicitly instead of being silently dropped (spec §7.2, §10).
 */
export function calculateGrammarScore(findings: unknown[]): GrammarScoreResult {
  if (!Array.isArray(findings)) throw new Error('Grammar evidence invalid: findings must be an array')

  const findingsBySeverity: Record<GrammarSeverity, number> = { light: 0, medium: 0, heavy: 0 }
  let totalPenalty = 0

  for (const finding of findings) {
    if (!isValidGrammarFinding(finding)) {
      throw new Error('Grammar evidence invalid: each finding needs a category and severity of light|medium|heavy with optional confidence in 0..1')
    }
    findingsBySeverity[finding.severity] += 1
    totalPenalty += GRAMMAR_SEVERITY_PENALTIES[finding.severity]
  }

  const score = clampScore(100 - totalPenalty)
  return {
    score,
    rawMetrics: {
      findingsBySeverity,
      totalPenalty,
      totalFindings: findings.length,
    },
  }
}

/** Source-defined audio quality gate (spec §9). */
export type AudioQualityResult =
  | { accepted: true; snrDb: number; speechDurationMs: number }
  | {
      accepted: false
      reason: 'RETRY_AUDIO_TOO_NOISY' | 'RETRY_SPEECH_TOO_SHORT'
      snrDb?: number
      speechDurationMs?: number
    }

const MINIMUM_SPEECH_DURATION_MS = 1_500
const MINIMUM_SNR_DB = 10

export function evaluateAudioQuality(input: {
  snrDb: number
  speechDurationMs: number
}): AudioQualityResult {
  const { snrDb, speechDurationMs } = input
  if (!Number.isFinite(snrDb) || !Number.isFinite(speechDurationMs)) {
    return { accepted: false, reason: 'RETRY_SPEECH_TOO_SHORT' }
  }
  if (speechDurationMs < MINIMUM_SPEECH_DURATION_MS) {
    return { accepted: false, reason: 'RETRY_SPEECH_TOO_SHORT', snrDb, speechDurationMs }
  }
  if (snrDb < MINIMUM_SNR_DB) {
    return { accepted: false, reason: 'RETRY_AUDIO_TOO_NOISY', snrDb, speechDurationMs }
  }
  return { accepted: true, snrDb, speechDurationMs }
}

/**
 * Source-defined EWMA progression (spec §12):
 * progress_new = 0.3 * Sfinal + 0.7 * progress_old
 *
 * The session score is never overwritten by the EWMA; callers persist both.
 */
export function updateProgressEwma(previousProgress: number, sessionFinalScore: number): number {
  if (!Number.isFinite(previousProgress) || !Number.isFinite(sessionFinalScore)) {
    throw new Error('EWMA inputs must be finite numbers')
  }
  const previous = clampScore(previousProgress)
  const session = clampScore(sessionFinalScore)
  return clampScore(0.3 * session + 0.7 * previous)
}

/** Source-defined progression rules (spec §12). CEFR mapping stays open. */
export const PROGRESSION_ELIGIBLE_THRESHOLD = 80
export const PROGRESSION_ELIGIBLE_CONSECUTIVE_SESSIONS = 3
export const PROGRESSION_INTERVENTION_THRESHOLD = 55

export function isEligibleForNextCefrModule(consecutiveSessionsAtOrAboveThreshold: number): boolean {
  return consecutiveSessionsAtOrAboveThreshold >= PROGRESSION_ELIGIBLE_CONSECUTIVE_SESSIONS
}

export function shouldTriggerIntervention(progressEwma: number): boolean {
  return Number.isFinite(progressEwma) && progressEwma < PROGRESSION_INTERVENTION_THRESHOLD
}
