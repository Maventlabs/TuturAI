import {
  calculateFluencyScore,
  calculateGrammarScore,
  calculateOverallScore,
  calculateWordsPerMinute,
  resolveGrammarMetricStatus,
  scoreIntonationFromPitch,
  scorePronunciationFromAlignment,
  scoreVocabularyFromTranscript,
  SCORING_VERSION,
  type Assessment,
  type AssessmentMode,
  type CanonicalRawMetrics,
  type CanonicalScoringMetadata,
  type CanonicalScoringMode,
  type DimensionScoreSource,
  type MetricStatus,
  type NormalizedAssessment,
  type PronunciationAlignmentEvidence,
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

/** Structured evidence contract (SCORING_SPEC §5, §6, §7, §8, §13). */
export interface AssessmentStructuredEvidence {
  fluency?: FluencyAudioEvidence
  grammar?: unknown[]
  /** Word-level forced alignment evidence (expected/actual/confidence per phoneme). */
  pronunciation?: PronunciationAlignmentEvidence
  /** Student transcript for vocabulary/diversity analysis (never the LLM's own text). */
  vocabularyTranscript?: string
  /** Optional acoustic pitch evidence for the intonation formula. */
  intonation?: {
    voicedDurationMs?: number | null
    pitchPoints: Array<{ timeMs: number; f0Hz: number }>
  }
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

/** Per-dimension canonical resolution (D9 missing-metric/confidence policy). */
interface CanonicalDimensionOutcome {
  scores: CanonicalScoringMetadata['scores']
  rawMetrics: CanonicalRawMetrics
  sources: Record<string, DimensionScoreSource>
  metricStatuses: Record<string, MetricStatus>
}

interface EvidenceChannelFailure {
  dimension: string
  message: string
}

type EvidenceChannelResult =
  | { ok: true; score: number; status: MetricStatus; rawMetrics: CanonicalRawMetrics }
  | { ok: false; failure: EvidenceChannelFailure }

/**
 * Canonical dimension resolution (SCORING_SPEC §13 + Human Decision Gate D9):
 * every dimension with structured evidence is recomputed by the deterministic
 * engine; dimensions without evidence keep the provider estimate labeled
 * PROVIDER_ESTIMATE. Corrupt evidence fails the whole assessment explicitly
 * (spec §10) instead of being silently dropped. Missing engine evidence never
 * becomes a fabricated score.
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
  const metricStatuses: Record<string, MetricStatus> = {
    pronunciation: 'insufficient_evidence',
    fluency: 'insufficient_evidence',
    intonation: 'insufficient_evidence',
    grammar: 'insufficient_evidence',
    vocabulary: 'insufficient_evidence',
  }
  void mode

  const failures: EvidenceChannelFailure[] = []

  // -- Fluency (existing SCORING-004 channel) --------------------------------
  const fluencyEvidence = input.audioEvidence?.fluency ?? input.structuredEvidence?.fluency
  if (fluencyEvidence) {
    try {
      const wpm = calculateWordsPerMinute(fluencyEvidence.wordCount, fluencyEvidence.spokenDurationMs)
      const fluency = calculateFluencyScore({
        wpm,
        totalPauseDurationMs: fluencyEvidence.totalPauseDurationMs,
        totalRecordingDurationMs: fluencyEvidence.totalRecordingDurationMs,
      })
      scores.fluency = fluency.score
      sources.fluency = 'CANONICAL_ENGINE'
      metricStatuses.fluency = 'complete'
      rawMetrics.wpm = wpm
      rawMetrics.pauseRatio = fluency.rawMetrics.pauseRatio
    } catch (error) {
      failures.push({ dimension: 'fluency', message: error instanceof Error ? error.message : String(error) })
    }
  } else {
    metricStatuses.fluency = 'insufficient_evidence'
  }

  // -- Grammar (existing SCORING-006 channel + D5 length policy) --------------
  const grammarFindings = input.structuredEvidence?.grammar
  if (Array.isArray(grammarFindings)) {
    try {
      const grammar = calculateGrammarScore(grammarFindings)
      const transcriptTokens = tokenizeForCounts(input.structuredEvidence?.vocabularyTranscript ?? result.transcript)
      scores.grammar = grammar.score
      sources.grammar = 'CANONICAL_ENGINE'
      metricStatuses.grammar = resolveGrammarMetricStatus(transcriptTokens)
      rawMetrics.grammarFindingsBySeverity = JSON.stringify(grammar.rawMetrics.findingsBySeverity)
      rawMetrics.grammarTotalFindings = grammar.rawMetrics.totalFindings
      rawMetrics.grammarTokenCount = transcriptTokens
    } catch (error) {
      failures.push({ dimension: 'grammar', message: error instanceof Error ? error.message : String(error) })
    }
  } else {
    metricStatuses.grammar = 'insufficient_evidence'
  }

  // -- Pronunciation (new SCORING-003 channel: D1 + D2) ----------------------
  const pronunciationEvidence = input.structuredEvidence?.pronunciation
  if (pronunciationEvidence) {
    try {
      const pronunciation = scorePronunciationFromAlignment(pronunciationEvidence)
      if (pronunciation.score !== null) {
        scores.pronunciation = pronunciation.score
        sources.pronunciation = 'CANONICAL_ENGINE'
        metricStatuses.pronunciation = pronunciation.status
        rawMetrics.phonemeErrorRate = pronunciation.rawMetrics.calibratedPer ?? undefined
        rawMetrics.pronunciationTargetPhonemes = pronunciation.rawMetrics.targetPhonemes
        rawMetrics.pronunciationAcceptedAccentVariants = pronunciation.rawMetrics.acceptedAccentVariants
        rawMetrics.pronunciationMildPenaltyVariants = pronunciation.rawMetrics.mildPenaltyVariants
        rawMetrics.pronunciationFullErrors = pronunciation.rawMetrics.fullErrors
        rawMetrics.pronunciationDeletions = pronunciation.rawMetrics.deletions
      } else {
        // D9: engine evidence existed but was insufficient — the provider
        // estimate stands in, explicitly labeled as a fallback (never canonical).
        metricStatuses.pronunciation = 'insufficient_evidence'
        sources.pronunciation = 'PROVIDER_ESTIMATE_FALLBACK'
        rawMetrics.pronunciationTargetPhonemes = pronunciation.rawMetrics.targetPhonemes
        rawMetrics.pronunciationMeanConfidence = pronunciation.rawMetrics.meanConfidence
      }
    } catch (error) {
      failures.push({ dimension: 'pronunciation', message: error instanceof Error ? error.message : String(error) })
    }
  } else {
    metricStatuses.pronunciation = 'insufficient_evidence'
  }

  // -- Vocabulary (new SCORING-007 channel: D6 + D7) -------------------------
  const vocabularyTranscript = input.structuredEvidence?.vocabularyTranscript ?? null
  if (vocabularyTranscript !== null && vocabularyTranscript.trim()) {
    try {
      const vocabulary = scoreVocabularyFromTranscript(vocabularyTranscript)
      if (vocabulary.score !== null) {
        scores.vocabulary = vocabulary.score
        sources.vocabulary = 'CANONICAL_ENGINE'
        metricStatuses.vocabulary = vocabulary.status
        rawMetrics.typeTokenRatio = vocabulary.rawMetrics.ttrNormInput ?? undefined
        rawMetrics.vocabularyMattr = vocabulary.rawMetrics.mattr
        rawMetrics.vocabularyRawTtr = vocabulary.rawMetrics.rawTtr
        rawMetrics.vocabularyCefrScore = vocabulary.rawMetrics.cefrVocabScore
        rawMetrics.vocabularyTotalTokens = vocabulary.rawMetrics.totalTokens
        rawMetrics.vocabularyEstimatedCefrBand = vocabulary.rawMetrics.estimatedCefrBand
        rawMetrics.vocabularyCefrBandingLabel = vocabulary.rawMetrics.cefrBandingLabel
      } else {
        // D9: engine evidence existed but was insufficient — labeled fallback.
        metricStatuses.vocabulary = 'insufficient_evidence'
        sources.vocabulary = 'PROVIDER_ESTIMATE_FALLBACK'
        rawMetrics.vocabularyTotalTokens = vocabulary.rawMetrics.totalTokens
      }
    } catch (error) {
      failures.push({ dimension: 'vocabulary', message: error instanceof Error ? error.message : String(error) })
    }
  } else {
    metricStatuses.vocabulary = 'insufficient_evidence'
  }

  // -- Intonation (new SCORING-005 channel: D4) ------------------------------
  const intonationEvidence = input.structuredEvidence?.intonation
  if (intonationEvidence) {
    try {
      const intonation = scoreIntonationFromPitch(intonationEvidence)
      if (intonation.score !== null) {
        scores.intonation = intonation.score
        sources.intonation = 'CANONICAL_ENGINE'
        metricStatuses.intonation = intonation.status
        rawMetrics.intonationPitchVariationSt = intonation.rawMetrics.pitchVariationSemitones
        rawMetrics.intonationSlopeVariationSt = intonation.rawMetrics.slopeVariationSemitones
        rawMetrics.intonationPitchPointCount = intonation.rawMetrics.pitchPointCount
      } else {
        // D9: engine evidence existed but was insufficient — labeled fallback.
        metricStatuses.intonation = 'insufficient_evidence'
        sources.intonation = 'PROVIDER_ESTIMATE_FALLBACK'
        rawMetrics.intonationPitchPointCount = intonation.rawMetrics.pitchPointCount
      }
    } catch (error) {
      failures.push({ dimension: 'intonation', message: error instanceof Error ? error.message : String(error) })
    }
  } else {
    metricStatuses.intonation = 'insufficient_evidence'
  }

  if (failures.length > 0) {
    const details = failures.map((failure) => `${failure.dimension}: ${failure.message}`).join('; ')
    throw new Error(`Assessment evidence invalid: ${details}`)
  }

  if (result.confidence !== null) rawMetrics.providerConfidence = result.confidence
  rawMetrics.metricStatuses = JSON.stringify(metricStatuses)

  scores.final = calculateOverallScore(mode, {
    ...result,
    fluency: scores.fluency,
    grammar: scores.grammar,
  })

  return { scores, rawMetrics, sources, metricStatuses }
}

/** Approximate token count for thin-sample status checks (documented D5 policy). */
function tokenizeForCounts(transcript: string): number {
  const matches = transcript.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []
  return matches.length
}

/**
 * Canonical scoring metadata for an online full assessment (SCORING_SPEC
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
  const hasStructuredEvidence = Boolean(
    input.audioEvidence?.fluency
    || input.structuredEvidence?.grammar
    || input.structuredEvidence?.pronunciation
    || input.structuredEvidence?.vocabularyTranscript
    || input.structuredEvidence?.intonation,
  )
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
          pronunciation: canonical.scores.pronunciation,
          fluency: canonical.scores.fluency,
          intonation: canonical.scores.intonation,
          grammar: canonical.scores.grammar,
          vocabulary: canonical.scores.vocabulary,
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
          metricStatuses: canonical.metricStatuses,
        }
      : {}),
  }

  return input.save(assessment)
}
