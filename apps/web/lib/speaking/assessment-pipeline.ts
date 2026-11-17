import {
  SCORING_VERSION,
  calculateFluencyScore,
  calculateGrammarScore,
  calculateWeightedFinalScore,
  calculateWordsPerMinute,
  evaluateAudioQuality,
  resolveGrammarMetricStatus,
  scoreIntonationFromPitch,
  scorePronunciationFromAlignment,
  scoreVocabularyFromTranscript,
  type Assessment,
  type AssessmentWithScoreSources,
  type CanonicalRawMetrics,
  type DimensionScoreSource,
  type MetricStatus,
  type PronunciationAlignmentEvidence,
  type SpeakingPracticeMode,
  type SpeakingScenario,
  type SpeakingSessionType,
} from '@tuturai/domain'
import { analyzeAcousticSignal, type AcousticAnalysis } from '@/lib/audio/acoustic-analysis'
import { decodeWavPcm16, WavDecodeError } from '@/lib/audio/wav'
import type { SpeakingAnalysis, SpeakingAnalysisRequest } from '@/lib/ai/speaking-analysis-provider'

/**
 * Speaking Practice assessment pipeline.
 *
 * Order of operations is fixed by SCORING_SPEC.md: the audio quality gate runs
 * before any provider call, the transcript comes from server-side STT, acoustic
 * evidence comes from the decoded signal, the LLM only produces structured
 * findings, and every number is produced by the canonical engine in
 * `@tuturai/domain`. A dimension without evidence keeps a null score — it is
 * never zeroed, estimated, or filled in to make the dashboard look complete.
 */

export type SpeakingAttemptStatus =
  | 'CREATED'
  | 'RECORDING'
  | 'UPLOADING'
  | 'QUALITY_CHECK'
  | 'TRANSCRIBING'
  | 'ACOUSTIC_ANALYSIS'
  | 'LLM_ANALYSIS'
  | 'SCORING'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'RETRY_REQUIRED'
  | 'FAILED'

export type SpeakingDimension = 'pronunciation' | 'fluency' | 'intonation' | 'grammar' | 'vocabulary'

export const SPEAKING_DIMENSIONS: readonly SpeakingDimension[] = [
  'pronunciation',
  'fluency',
  'intonation',
  'grammar',
  'vocabulary',
]

export interface SpeakingStageTiming {
  id: string
  label: string
  durationMs: number
}

export interface SpeakingAttemptScores {
  pronunciation: number | null
  fluency: number | null
  intonation: number | null
  grammar: number | null
  vocabulary: number | null
  final: number | null
}

export interface SpeakingAttempt {
  id: string
  sessionId: string
  studentId: string
  scenarioId: string
  scenarioTitle: string
  practiceMode: SpeakingPracticeMode
  sessionType: SpeakingSessionType
  status: SpeakingAttemptStatus
  createdAt: string
  completedAt: string | null
  durationMs: number
  wordCount: number
  transcript: string
  qualityGate: {
    accepted: boolean
    snrDb: number
    speechDurationMs: number
    reason: 'RETRY_AUDIO_TOO_NOISY' | 'RETRY_SPEECH_TOO_SHORT' | null
  }
  acoustic: {
    snrDb: number
    speechDurationMs: number
    totalPauseDurationMs: number
    pauseRatio: number
    voicedDurationMs: number
    pitchPointCount: number
    meanF0Hz: number | null
    pitchVariationSemitones: number | null
    wpm: number | null
  }
  scores: SpeakingAttemptScores
  metricStatuses: Record<SpeakingDimension, MetricStatus>
  scoreSources: Partial<Record<SpeakingDimension, DimensionScoreSource>>
  rawMetrics: CanonicalRawMetrics
  analysis: SpeakingAnalysis | null
  feedback: string
  failure: { code: string; message: string; retryable: boolean } | null
  scoringVersion: string
  provider: {
    sttModelId: string | null
    llmModelId: string | null
    pronunciationModelId: string | null
  }
  stages: SpeakingStageTiming[]
  assessmentId: string | null
}

export interface SpeakingPipelineDeps {
  transcribe: (audio: { bytes: Uint8Array; mimeType: string; filename: string }) => Promise<{
    text: string
    confidence: number | null
    modelId: string | null
  }>
  analyzeLanguage: (request: SpeakingAnalysisRequest) => Promise<SpeakingAnalysis>
  /** Optional forced-alignment adapter; absent means pronunciation stays unmeasured. */
  alignPronunciation?: (audio: {
    bytes: Uint8Array
    mimeType: string
    filename: string
    targetText: string
  }) => Promise<{ evidence: PronunciationAlignmentEvidence; modelId: string | null } | null>
  saveAttempt: (attempt: SpeakingAttempt) => Promise<SpeakingAttempt>
  /** Canonical result sink for cross-feature consumers (XP, teacher analytics). */
  saveAssessment?: (assessment: Assessment) => Promise<Assessment>
  now?: () => Date
}

export interface SpeakingAssessmentInput {
  studentId: string
  sessionId: string
  scenario: SpeakingScenario
  practiceMode: SpeakingPracticeMode
  sessionType: SpeakingSessionType
  audio: { bytes: Uint8Array; mimeType: string; filename: string }
  signal?: AbortSignal
}

const EMPTY_SCORES: SpeakingAttemptScores = {
  pronunciation: null,
  fluency: null,
  intonation: null,
  grammar: null,
  vocabulary: null,
  final: null,
}

const EMPTY_STATUSES: Record<SpeakingDimension, MetricStatus> = {
  pronunciation: 'insufficient_evidence',
  fluency: 'insufficient_evidence',
  intonation: 'insufficient_evidence',
  grammar: 'insufficient_evidence',
  vocabulary: 'insufficient_evidence',
}

function countWords(transcript: string) {
  return (transcript.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).length
}

function emptyAcoustic(): SpeakingAttempt['acoustic'] {
  return {
    snrDb: -20,
    speechDurationMs: 0,
    totalPauseDurationMs: 0,
    pauseRatio: 0,
    voicedDurationMs: 0,
    pitchPointCount: 0,
    meanF0Hz: null,
    pitchVariationSemitones: null,
    wpm: null,
  }
}

function acousticSummary(analysis: AcousticAnalysis, wpm: number | null): SpeakingAttempt['acoustic'] {
  return {
    snrDb: analysis.snrDb,
    speechDurationMs: analysis.speechDurationMs,
    totalPauseDurationMs: analysis.totalPauseDurationMs,
    pauseRatio: analysis.pauseRatio,
    voicedDurationMs: analysis.voicedDurationMs,
    pitchPointCount: analysis.pitchPoints.length,
    meanF0Hz: analysis.meanF0Hz,
    pitchVariationSemitones: analysis.pitchVariationSemitones,
    wpm,
  }
}

function buildFeedback(analysis: SpeakingAnalysis | null, scores: SpeakingAttemptScores) {
  if (!analysis) return ''
  const parts: string[] = []
  if (analysis.strengths.length > 0) parts.push(analysis.strengths[0])
  if (analysis.improvements.length > 0) parts.push(analysis.improvements[0])
  if (parts.length === 0 && analysis.relevance.comment) parts.push(analysis.relevance.comment)
  if (scores.final === null) {
    parts.push('Overall score is withheld because not every dimension has enough evidence yet.')
  }
  return parts.join(' ').slice(0, 600)
}

export async function runSpeakingAssessment(
  input: SpeakingAssessmentInput,
  deps: SpeakingPipelineDeps,
): Promise<SpeakingAttempt> {
  const now = deps.now ?? (() => new Date())
  const startedAt = now()
  const stages: SpeakingStageTiming[] = []
  const markStage = (id: string, label: string, from: number) => {
    stages.push({ id, label, durationMs: Math.max(0, Math.round(performance.now() - from)) })
  }

  const base: SpeakingAttempt = {
    id: `${input.studentId}_${input.sessionId}`,
    sessionId: input.sessionId,
    studentId: input.studentId,
    scenarioId: input.scenario.id,
    scenarioTitle: input.scenario.title,
    practiceMode: input.practiceMode,
    sessionType: input.sessionType,
    status: 'QUALITY_CHECK',
    createdAt: startedAt.toISOString(),
    completedAt: null,
    durationMs: 0,
    wordCount: 0,
    transcript: '',
    qualityGate: { accepted: false, snrDb: -20, speechDurationMs: 0, reason: null },
    acoustic: emptyAcoustic(),
    scores: { ...EMPTY_SCORES },
    metricStatuses: { ...EMPTY_STATUSES },
    scoreSources: {},
    rawMetrics: {},
    analysis: null,
    feedback: '',
    failure: null,
    scoringVersion: SCORING_VERSION,
    provider: { sttModelId: null, llmModelId: null, pronunciationModelId: null },
    stages,
    assessmentId: null,
  }

  // -- 1. Decode + acoustic analysis (also feeds the quality gate) ------------
  const acousticStart = performance.now()
  let acoustic: AcousticAnalysis
  try {
    const decoded = decodeWavPcm16(input.audio.bytes)
    acoustic = analyzeAcousticSignal({ samples: decoded.samples, sampleRate: decoded.sampleRate })
  } catch (error) {
    if (error instanceof WavDecodeError) {
      return deps.saveAttempt({
        ...base,
        status: 'FAILED',
        failure: { code: 'INVALID_AUDIO', message: error.message, retryable: true },
      })
    }
    throw error
  }
  markStage('acoustic_analysis', 'Analysing speech characteristics', acousticStart)

  const quality = evaluateAudioQuality({ snrDb: acoustic.snrDb, speechDurationMs: acoustic.speechDurationMs })
  const qualityGate: SpeakingAttempt['qualityGate'] = {
    accepted: quality.accepted,
    snrDb: acoustic.snrDb,
    speechDurationMs: acoustic.speechDurationMs,
    reason: quality.accepted ? null : quality.reason,
  }

  if (!quality.accepted) {
    return deps.saveAttempt({
      ...base,
      status: 'RETRY_REQUIRED',
      durationMs: acoustic.durationMs,
      qualityGate,
      acoustic: acousticSummary(acoustic, null),
      failure: {
        code: quality.reason,
        message:
          quality.reason === 'RETRY_AUDIO_TOO_NOISY'
            ? 'The recording is too noisy to assess. Move somewhere quieter and record again.'
            : 'The recording is too short to assess. Speak for at least a few seconds and record again.',
        retryable: true,
      },
    })
  }

  // Energy alone cannot separate stationary noise (a fan, traffic) from speech:
  // both fill every frame. Voicing can. A recording with no periodic frames at
  // all contains no voice, so it is rejected before any provider is called.
  if (acoustic.voicedDurationMs === 0) {
    return deps.saveAttempt({
      ...base,
      status: 'RETRY_REQUIRED',
      durationMs: acoustic.durationMs,
      qualityGate: { ...qualityGate, accepted: false, reason: 'RETRY_AUDIO_TOO_NOISY' },
      acoustic: acousticSummary(acoustic, null),
      failure: {
        code: 'RETRY_AUDIO_TOO_NOISY',
        message: 'No voice was detected in the recording. Move somewhere quieter and speak clearly into the microphone.',
        retryable: true,
      },
    })
  }

  // -- 2. Server-side transcription ------------------------------------------
  const sttStart = performance.now()
  let transcription: { text: string; confidence: number | null; modelId: string | null }
  try {
    transcription = await deps.transcribe(input.audio)
  } catch (error) {
    const failure = error as { code?: string; message?: string; retryable?: boolean }
    return deps.saveAttempt({
      ...base,
      status: 'FAILED',
      durationMs: acoustic.durationMs,
      qualityGate,
      acoustic: acousticSummary(acoustic, null),
      failure: {
        code: failure.code ?? 'STT_FAILED',
        message: failure.message ?? 'Speech recognition failed.',
        retryable: failure.retryable ?? true,
      },
    })
  }
  markStage('transcribing', 'Transcribing speech', sttStart)

  const transcript = transcription.text.trim()
  if (!transcript) {
    return deps.saveAttempt({
      ...base,
      status: 'RETRY_REQUIRED',
      durationMs: acoustic.durationMs,
      qualityGate,
      acoustic: acousticSummary(acoustic, null),
      provider: { ...base.provider, sttModelId: transcription.modelId },
      failure: {
        code: 'RETRY_NO_SPEECH_RECOGNIZED',
        message: 'No speech was recognised in the recording. Try speaking a little louder and record again.',
        retryable: true,
      },
    })
  }

  const wordCount = countWords(transcript)
  const wpm = calculateWordsPerMinute(wordCount, acoustic.speechDurationMs)

  // -- 3. Language analysis (structured findings only) -----------------------
  const llmStart = performance.now()
  let analysis: SpeakingAnalysis
  try {
    analysis = await deps.analyzeLanguage({
      scenario: {
        title: input.scenario.title,
        category: input.scenario.category,
        difficulty: input.scenario.difficulty,
        situation: input.scenario.situation,
        context: input.scenario.context,
        objective: input.scenario.objective,
        question: input.scenario.question,
      },
      practiceMode: input.practiceMode,
      sessionType: input.sessionType,
      transcript,
      durationMs: acoustic.durationMs,
      wordCount,
      acoustic: {
        wpm,
        pauseRatio: acoustic.pauseRatio,
        meanF0Hz: acoustic.meanF0Hz,
        pitchVariationSemitones: acoustic.pitchVariationSemitones,
      },
      signal: input.signal,
    })
  } catch (error) {
    const failure = error as { code?: string; message?: string; retryable?: boolean }
    return deps.saveAttempt({
      ...base,
      status: 'FAILED',
      durationMs: acoustic.durationMs,
      wordCount,
      transcript,
      qualityGate,
      acoustic: acousticSummary(acoustic, wpm),
      provider: { ...base.provider, sttModelId: transcription.modelId },
      failure: {
        code: failure.code ?? 'LLM_ANALYSIS_FAILED',
        message: failure.message ?? 'Language analysis failed.',
        retryable: failure.retryable ?? true,
      },
    })
  }
  markStage('llm_analysis', 'Evaluating language performance', llmStart)

  // -- 4. Optional forced alignment (pronunciation) --------------------------
  let pronunciationEvidence: PronunciationAlignmentEvidence | null = null
  let pronunciationModelId: string | null = null
  if (deps.alignPronunciation) {
    try {
      const aligned = await deps.alignPronunciation({ ...input.audio, targetText: transcript })
      if (aligned) {
        pronunciationEvidence = aligned.evidence
        pronunciationModelId = aligned.modelId
      }
    } catch {
      // A pronunciation provider failure must not fabricate a score, and must not
      // discard the language evidence that already succeeded.
      pronunciationEvidence = null
    }
  }

  // -- 5. Canonical scoring --------------------------------------------------
  const scoringStart = performance.now()
  const scores: SpeakingAttemptScores = { ...EMPTY_SCORES }
  const metricStatuses: Record<SpeakingDimension, MetricStatus> = { ...EMPTY_STATUSES }
  const scoreSources: Partial<Record<SpeakingDimension, DimensionScoreSource>> = {}
  const rawMetrics: CanonicalRawMetrics = {
    wpm,
    pauseRatio: acoustic.pauseRatio,
    snrDb: acoustic.snrDb,
    speechDurationMs: acoustic.speechDurationMs,
    totalPauseDurationMs: acoustic.totalPauseDurationMs,
    wordCount,
    providerConfidence: transcription.confidence,
  }

  const fluency = calculateFluencyScore({
    wpm,
    totalPauseDurationMs: acoustic.totalPauseDurationMs,
    totalRecordingDurationMs: acoustic.durationMs,
  })
  scores.fluency = fluency.score
  metricStatuses.fluency = 'complete'
  scoreSources.fluency = 'CANONICAL_ENGINE'

  const grammar = calculateGrammarScore(analysis.grammarFindings)
  scores.grammar = grammar.score
  metricStatuses.grammar = resolveGrammarMetricStatus(wordCount)
  scoreSources.grammar = 'CANONICAL_ENGINE'
  rawMetrics.grammarTotalFindings = grammar.rawMetrics.totalFindings
  rawMetrics.grammarFindingsBySeverity = JSON.stringify(grammar.rawMetrics.findingsBySeverity)
  rawMetrics.grammarTokenCount = wordCount

  const vocabulary = scoreVocabularyFromTranscript(transcript)
  if (vocabulary.score !== null) {
    scores.vocabulary = vocabulary.score
    metricStatuses.vocabulary = vocabulary.status
    scoreSources.vocabulary = 'CANONICAL_ENGINE'
  }
  rawMetrics.vocabularyTotalTokens = vocabulary.rawMetrics.totalTokens
  rawMetrics.vocabularyMattr = vocabulary.rawMetrics.mattr
  rawMetrics.vocabularyRawTtr = vocabulary.rawMetrics.rawTtr
  rawMetrics.vocabularyCefrScore = vocabulary.rawMetrics.cefrVocabScore
  rawMetrics.vocabularyEstimatedCefrBand = vocabulary.rawMetrics.estimatedCefrBand

  const intonation = scoreIntonationFromPitch({
    voicedDurationMs: acoustic.voicedDurationMs,
    pitchPoints: acoustic.pitchPoints,
  })
  if (intonation.score !== null) {
    scores.intonation = intonation.score
    metricStatuses.intonation = intonation.status
    scoreSources.intonation = 'CANONICAL_ENGINE'
  }
  rawMetrics.intonationPitchPointCount = intonation.rawMetrics.pitchPointCount
  rawMetrics.intonationPitchVariationSt = intonation.rawMetrics.pitchVariationSemitones
  rawMetrics.intonationSlopeVariationSt = intonation.rawMetrics.slopeVariationSemitones

  if (pronunciationEvidence) {
    const pronunciation = scorePronunciationFromAlignment(pronunciationEvidence)
    if (pronunciation.score !== null) {
      scores.pronunciation = pronunciation.score
      metricStatuses.pronunciation = pronunciation.status
      scoreSources.pronunciation = 'CANONICAL_ENGINE'
    }
    rawMetrics.phonemeErrorRate = pronunciation.rawMetrics.calibratedPer ?? undefined
    rawMetrics.pronunciationTargetPhonemes = pronunciation.rawMetrics.targetPhonemes
    rawMetrics.pronunciationMeanConfidence = pronunciation.rawMetrics.meanConfidence
  }

  const complete = SPEAKING_DIMENSIONS.every((dimension) => scores[dimension] !== null)
  if (complete) {
    scores.final = calculateWeightedFinalScore({
      pronunciation: scores.pronunciation as number,
      fluency: scores.fluency as number,
      intonation: scores.intonation as number,
      grammar: scores.grammar as number,
      vocabulary: scores.vocabulary as number,
    })
  }
  rawMetrics.metricStatuses = JSON.stringify(metricStatuses)
  markStage('scoring', 'Calculating canonical score', scoringStart)

  const completedAt = now()
  const attempt: SpeakingAttempt = {
    ...base,
    status: complete ? 'COMPLETED' : 'INCOMPLETE',
    completedAt: completedAt.toISOString(),
    durationMs: acoustic.durationMs,
    wordCount,
    transcript,
    qualityGate,
    acoustic: acousticSummary(acoustic, wpm),
    scores,
    metricStatuses,
    scoreSources,
    rawMetrics,
    analysis,
    feedback: buildFeedback(analysis, scores),
    provider: {
      sttModelId: transcription.modelId,
      llmModelId: null,
      pronunciationModelId,
    },
  }

  const saved = await deps.saveAttempt(attempt)

  if (scores.final !== null && deps.saveAssessment) {
    const assessment: AssessmentWithScoreSources = {
      id: attempt.id,
      sessionId: attempt.sessionId,
      studentId: attempt.studentId,
      mode: 'speaking',
      pronunciation: scores.pronunciation as number,
      fluency: scores.fluency as number,
      intonation: scores.intonation as number,
      grammar: scores.grammar as number,
      vocabulary: scores.vocabulary as number,
      overall: scores.final,
      transcript,
      feedback: attempt.feedback,
      confidence: transcription.confidence,
      error: null,
      createdAt: attempt.createdAt,
      scoring: {
        scoringVersion: SCORING_VERSION,
        mode: 'ONLINE_FULL',
        scores: {
          pronunciation: scores.pronunciation as number,
          fluency: scores.fluency as number,
          intonation: scores.intonation as number,
          grammar: scores.grammar as number,
          vocabulary: scores.vocabulary as number,
          final: scores.final,
        },
        rawMetrics,
      },
      scoreSources,
      metricStatuses,
    }
    await deps.saveAssessment(assessment)
    return { ...saved, assessmentId: assessment.id }
  }

  return saved
}
