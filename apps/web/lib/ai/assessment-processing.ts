import {
  calculateFluencyScore,
  calculateGrammarScore,
  calculateOverallScore,
  calculateWordsPerMinute,
  SCORING_VERSION,
  type Assessment,
  type AssessmentMode,
  type CanonicalRawMetrics,
  type CanonicalScoringMetadata,
  type CanonicalScoringMode,
  type DimensionScoreSource,
  type NormalizedAssessment,
} from '@tuturai/domain'
import type { AssessmentProviderRequest } from './assessment-provider'

export interface AssessmentProviderLike {
  assess(request: AssessmentProviderRequest): Promise<NormalizedAssessment>
}

export type SaveAssessment = (assessment: Assessment) => Promise<Assessment>

/** Raw fluency evidence measured by the audio pipeline (never LLM-guessed). */
export interface FluencyAudioEvidence {
  wordCount: number
  spokenDurationMs: number
  totalPauseDurationMs: number
  totalRecordingDurationMs: number
}

/** Structured evidence contract (SCORING_SPEC.md §7, §5, §13). */
export interface AssessmentStructuredEvidence {
  fluency?: FluencyAudioEvidence
  grammar?: unknown[]
}

export interface ProcessAssessmentInput {
  provider: AssessmentProviderLike
  save: SaveAssessment
  studentId: string
  sessionId: string
  questionId?: string
  request: AssessmentProviderRequest
  mode?: AssessmentMode
  now?: Date
  /** Audio-pipeline measurements; overrides provider fluency estimates canonically. */
  audioEvidence?: {
    fluency?: FluencyAudioEvidence
  }
  /** Structured findings/evidence returned by the provider payload. */
  structuredEvidence?: AssessmentStructuredEvidence
}

interface CanonicalDimensionOutcome {
  scores: CanonicalScoringMetadata['scores']
  rawMetrics: CanonicalRawMetrics
  sources: Record<string, DimensionScoreSource>
}

/**
 * Canonical dimension resolution (SCORING_SPEC.md §13):
 * fluency and grammar come from the deterministic engine whenever their
 * structured evidence exists; without evidence the provider estimate is kept
 * and explicitly labeled, never silently treated as canonical.
 */
function resolveCanonicalScores(
  mode: AssessmentMode,
  result: NormalizedAssessment,
  input: ProcessAssessmentInput,
): CanonicalDimensionOutcome {
  const scores: CanonicalScoringMetadata['scores'] = {
    pronunciation: result.pronunciation,
    fluency: result.fluency,
    intonation: result.intonation,
    grammar: result.grammar,
    vocabulary: result.vocabulary,
    final: 0,
  }
  const rawMetrics: CanonicalRawMetrics = {}
  const sources: Record<string, DimensionScoreSource> = {
    pronunciation: 'PROVIDER_ESTIMATE',
    fluency: 'PROVIDER_ESTIMATE',
    intonation: 'PROVIDER_ESTIMATE',
    grammar: 'PROVIDER_ESTIMATE',
    vocabulary: 'PROVIDER_ESTIMATE',
  }
  void mode

  const fluencyEvidence = input.audioEvidence?.fluency ?? input.structuredEvidence?.fluency
  if (fluencyEvidence) {
    const wpm = calculateWordsPerMinute(fluencyEvidence.wordCount, fluencyEvidence.spokenDurationMs)
    const fluency = calculateFluencyScore({
      wpm,
      totalPauseDurationMs: fluencyEvidence.totalPauseDurationMs,
      totalRecordingDurationMs: fluencyEvidence.totalRecordingDurationMs,
    })
    scores.fluency = fluency.score
    sources.fluency = 'CANONICAL_ENGINE'
    rawMetrics.wpm = wpm
    rawMetrics.pauseRatio = fluency.rawMetrics.pauseRatio
  }

  const grammarFindings = input.structuredEvidence?.grammar
  if (Array.isArray(grammarFindings)) {
    const grammar = calculateGrammarScore(grammarFindings)
    scores.grammar = grammar.score
    sources.grammar = 'CANONICAL_ENGINE'
    rawMetrics.grammarFindingsBySeverity = JSON.stringify(grammar.rawMetrics.findingsBySeverity)
    rawMetrics.grammarTotalFindings = grammar.rawMetrics.totalFindings
  }

  if (result.confidence !== null) rawMetrics.providerConfidence = result.confidence

  scores.final = calculateOverallScore(mode, {
    ...result,
    fluency: scores.fluency,
    grammar: scores.grammar,
  })

  return { scores, rawMetrics, sources }
}

/**
 * Canonical scoring metadata for an online full assessment (SCORING_SPEC.md
 * §14–§16). The engine-owned final score equals the persisted `overall`, so the
 * aggregate consumers keep their contract while provenance and raw evidence are
 * preserved for versioned recomputation.
 */
function buildCanonicalScoringMetadata(
  mode: AssessmentMode,
  result: NormalizedAssessment,
  overall: number,
): CanonicalScoringMetadata {
  const scoringMode: CanonicalScoringMode = 'ONLINE_FULL'
  const confidence = result.confidence
  return {
    scoringVersion: SCORING_VERSION,
    mode: scoringMode,
    scores: {
      pronunciation: result.pronunciation,
      fluency: result.fluency,
      intonation: result.intonation,
      grammar: result.grammar,
      vocabulary: result.vocabulary,
      final: overall,
    },
    ...(confidence === null
      ? {}
      : { rawMetrics: { providerConfidence: confidence } }),
  }
}

export async function processAssessment(input: ProcessAssessmentInput): Promise<Assessment> {
  const result = await input.provider.assess(input.request)
  const mode = input.mode ?? input.request.mode ?? 'speaking'
  const hasStructuredEvidence = Boolean(input.audioEvidence?.fluency || input.structuredEvidence?.grammar)
  const overall = calculateOverallScore(mode, result)
  const canonical = hasStructuredEvidence ? resolveCanonicalScores(mode, result, input) : null

  const scoringMetadata: CanonicalScoringMetadata = canonical
    ? {
        scoringVersion: SCORING_VERSION,
        mode: 'ONLINE_FULL',
        scores: canonical.scores,
        rawMetrics: canonical.rawMetrics,
      }
    : buildCanonicalScoringMetadata(mode, result, overall)

  const finalOverall = canonical ? canonical.scores.final : overall
  const assessment: Assessment = {
    id: `${input.studentId}_${input.sessionId}`,
    sessionId: input.sessionId,
    ...(input.questionId ? { questionId: input.questionId } : {}),
    studentId: input.studentId,
    ...result,
    ...(canonical
      ? {
          fluency: canonical.scores.fluency,
          grammar: canonical.scores.grammar,
          overall: finalOverall,
        }
      : {}),
    mode,
    overall: finalOverall,
    error: null,
    createdAt: (input.now ?? new Date()).toISOString(),
    scoring: scoringMetadata,
    ...(canonical
      ? {
          scoreSources: canonical.sources,
        }
      : {}),
  }

  return input.save(assessment)
}
