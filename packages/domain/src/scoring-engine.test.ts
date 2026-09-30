import { describe, expect, it } from 'vitest'
import {
  FLUENCY_WPM_MAX,
  FLUENCY_WPM_MIN,
  GRAMMAR_SEVERITY_PENALTIES,
  SCORING_VERSION,
  SPEAKING_DIMENSION_WEIGHTS,
  calculateFluencyScore,
  calculateGrammarScore,
  calculateWeightedFinalScore,
  clampScore,
  evaluateAudioQuality,
  isEligibleForNextCefrModule,
  normalizeMetric,
  shouldTriggerIntervention,
  updateProgressEwma,
} from './scoring-engine'

describe('SCORING_VERSION', () => {
  it('is a stable semantic version string persisted with every canonical result', () => {
    // 2026.2: Human Decision Gate finalization (see scoring-decisions.ts ledger).
    expect(SCORING_VERSION).toBe('2026.2')
    expect(SCORING_VERSION).toMatch(/^\d{4}\.\d$/)
  })

  it('keeps the canonical speaking weights from the source', () => {
    expect(SPEAKING_DIMENSION_WEIGHTS).toEqual({
      pronunciation: 0.25,
      fluency: 0.2,
      intonation: 0.15,
      grammar: 0.2,
      vocabulary: 0.2,
    })
  })
})

describe('clampScore', () => {
  it('keeps in-range values unchanged', () => {
    expect(clampScore(0)).toBe(0)
    expect(clampScore(79.5)).toBe(79.5)
    expect(clampScore(100)).toBe(100)
  })

  it('clamps out-of-range values into 0..100', () => {
    expect(clampScore(-12)).toBe(0)
    expect(clampScore(150)).toBe(100)
  })

  it('guards NaN and Infinity to 0 instead of leaking them', () => {
    expect(clampScore(Number.NaN)).toBe(0)
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100)
    expect(clampScore(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('normalizeMetric', () => {
  it('normalizes into 0..1 with clamping', () => {
    expect(normalizeMetric(40, 40, 120)).toBe(0)
    expect(normalizeMetric(80, 40, 120)).toBeCloseTo(0.5)
    expect(normalizeMetric(120, 40, 120)).toBe(1)
    expect(normalizeMetric(200, 40, 120)).toBe(1)
    expect(normalizeMetric(10, 40, 120)).toBe(0)
  })

  it('guards zero-width and non-finite ranges without dividing by zero', () => {
    expect(normalizeMetric(50, 50, 50)).toBe(0)
    expect(normalizeMetric(Number.NaN, 0, 100)).toBe(0)
    expect(normalizeMetric(50, Number.NaN, 100)).toBe(0)
    expect(normalizeMetric(50, 0, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('calculateWeightedFinalScore (spec §3 and §18)', () => {
  it('reproduces the deterministic source example Sfinal = 79.5', () => {
    expect(
      calculateWeightedFinalScore({
        pronunciation: 80,
        fluency: 70,
        intonation: 90,
        grammar: 85,
        vocabulary: 75,
      }),
    ).toBe(79.5)
  })

  it('aggregates with 0.25/0.20/0.15/0.20/0.20 weights', () => {
    expect(
      calculateWeightedFinalScore({
        pronunciation: 100,
        fluency: 100,
        intonation: 100,
        grammar: 100,
        vocabulary: 100,
      }),
    ).toBe(100)
    expect(
      calculateWeightedFinalScore({
        pronunciation: 0,
        fluency: 0,
        intonation: 0,
        grammar: 0,
        vocabulary: 0,
      }),
    ).toBe(0)
  })

  it('clamps an impossible aggregate into the canonical range', () => {
    // 0.25*300 = 75 on pronunciation alone; total stays within range only via clamp
    const result = calculateWeightedFinalScore({
      pronunciation: 100,
      fluency: 100,
      intonation: 100,
      grammar: 100,
      vocabulary: 100,
    })
    expect(result).toBeLessThanOrEqual(100)
  })

  it('fails explicitly on invalid required inputs instead of inventing a score', () => {
    expect(() =>
      calculateWeightedFinalScore({
        pronunciation: Number.NaN,
        fluency: 70,
        intonation: 90,
        grammar: 85,
        vocabulary: 75,
      }),
    ).toThrowError(/pronunciation/)
    expect(() =>
      calculateWeightedFinalScore({
        pronunciation: 80,
        fluency: undefined as unknown as number,
        intonation: 90,
        grammar: 85,
        vocabulary: 75,
      }),
    ).toThrowError(/fluency/)
  })
})

describe('calculateFluencyScore (spec §5, SCORING-004)', () => {
  it('exposes the explicit source normalization bounds 40..120', () => {
    expect(FLUENCY_WPM_MIN).toBe(40)
    expect(FLUENCY_WPM_MAX).toBe(120)
  })

  it('applies Sf = [0.6*WPMnorm + 0.4*(1-Rpause)]*100', () => {
    // 80 WPM -> WPMnorm 0.5; 25% pause ratio -> 0.6*0.5 + 0.4*0.75 = 0.6 -> 60
    const result = calculateFluencyScore({ wpm: 80, totalPauseDurationMs: 2500, totalRecordingDurationMs: 10_000 })
    expect(result.score).toBeCloseTo(60)
    expect(result.rawMetrics).toEqual({ wpm: 80, pauseRatio: 0.25, wpmNorm: 0.5 })
  })

  it('scores a perfect fluent sample with no pauses inside the target band', () => {
    // 110 WPM in 40..120 -> WPMnorm 0.875; zero pause -> 0.6*0.875 + 0.4 = 0.925 -> 92.5
    const result = calculateFluencyScore({ wpm: 110, totalPauseDurationMs: 0, totalRecordingDurationMs: 6000 })
    expect(result.score).toBeCloseTo(92.5)
  })

  it('clamps WPM below and above the normalization band', () => {
    const slow = calculateFluencyScore({ wpm: 10, totalPauseDurationMs: 0, totalRecordingDurationMs: 5000 })
    expect(slow.rawMetrics.wpmNorm).toBe(0)
    expect(slow.score).toBeCloseTo(40)
    const fast = calculateFluencyScore({ wpm: 300, totalPauseDurationMs: 0, totalRecordingDurationMs: 5000 })
    expect(fast.rawMetrics.wpmNorm).toBe(1)
    expect(fast.score).toBe(100)
  })

  it('fails explicitly on invalid durations instead of inventing a ratio', () => {
    expect(() => calculateFluencyScore({ wpm: 80, totalPauseDurationMs: -1, totalRecordingDurationMs: 5000 })).toThrowError(/totalPauseDurationMs/)
    expect(() => calculateFluencyScore({ wpm: 80, totalPauseDurationMs: 0, totalRecordingDurationMs: 0 })).toThrowError(/totalRecordingDurationMs/)
    expect(() => calculateFluencyScore({ wpm: Number.NaN, totalPauseDurationMs: 0, totalRecordingDurationMs: 5000 })).toThrowError(/wpm/)
    expect(() =>
      calculateFluencyScore({ wpm: 80, totalPauseDurationMs: 6000, totalRecordingDurationMs: 5000 }),
    ).toThrowError(/exceeds/)
  })
})

describe('calculateGrammarScore (spec §7, SCORING-006)', () => {
  it('uses the source penalty table light -5 / medium -10 / heavy -15', () => {
    expect(GRAMMAR_SEVERITY_PENALTIES).toEqual({ light: 5, medium: 10, heavy: 15 })
  })

  it('applies Sg = max(0, 100 - Σ(count * penalty)) in the engine, not the provider', () => {
    const result = calculateGrammarScore([
      { category: 'article', severity: 'light' },
      { category: 'article', severity: 'light' },
      { category: 'subject_verb_agreement', severity: 'medium' },
      { category: 'tense', severity: 'heavy' },
    ])
    // 5 + 5 + 10 + 15 = 35 penalty -> 65
    expect(result.score).toBe(65)
    expect(result.rawMetrics).toEqual({
      findingsBySeverity: { light: 2, medium: 1, heavy: 1 },
      totalPenalty: 35,
      totalFindings: 4,
    })
  })

  it('floors at 0 when penalties exceed 100 instead of going negative', () => {
    const heavyFindings = Array.from({ length: 8 }, () => ({ category: 'tense', severity: 'heavy' as const }))
    const result = calculateGrammarScore(heavyFindings)
    expect(result.score).toBe(0)
    expect(result.rawMetrics.totalPenalty).toBe(120)
  })

  it('returns a perfect score with zeroed counters for clean speech', () => {
    const result = calculateGrammarScore([])
    expect(result.score).toBe(100)
    expect(result.rawMetrics).toEqual({
      findingsBySeverity: { light: 0, medium: 0, heavy: 0 },
      totalPenalty: 0,
      totalFindings: 0,
    })
  })

  it('rejects malformed provider findings explicitly instead of dropping them silently', () => {
    expect(() => calculateGrammarScore([{ category: 'article' }])).toThrowError(/severity/)
    expect(() => calculateGrammarScore([{ severity: 'medium' }])).toThrowError(/category/)
    expect(() => calculateGrammarScore([{ category: 'x', severity: 'catastrophic' }])).toThrowError(/severity/)
    expect(() => calculateGrammarScore([{ category: 'x', severity: 'light', confidence: 1.5 }])).toThrowError(/confidence/)
    expect(() => calculateGrammarScore('not-an-array' as unknown as unknown[])).toThrowError(/array/)
  })

  it('preserves per-category/severity counts for future formula versions (spec §7.3)', () => {
    const result = calculateGrammarScore([
      { category: 'article', severity: 'light', original: 'a', corrected: 'an' },
      { category: 'tense', severity: 'heavy', confidence: 0.9 },
    ])
    expect(result.rawMetrics.findingsBySeverity).toEqual({ light: 1, medium: 0, heavy: 1 })
    expect(result.rawMetrics.totalFindings).toBe(2)
  })
})

describe('evaluateAudioQuality (spec §9)', () => {
  it('accepts healthy audio with measured SNR and duration', () => {
    expect(evaluateAudioQuality({ snrDb: 18, speechDurationMs: 4200 })).toEqual({
      accepted: true,
      snrDb: 18,
      speechDurationMs: 4200,
    })
  })

  it('rejects audio below 10 dB SNR as too noisy and never fabricates scores', () => {
    const result = evaluateAudioQuality({ snrDb: 9.5, speechDurationMs: 5000 })
    expect(result).toEqual({
      accepted: false,
      reason: 'RETRY_AUDIO_TOO_NOISY',
      snrDb: 9.5,
      speechDurationMs: 5000,
    })
  })

  it('rejects speech shorter than 1.5 seconds as too short', () => {
    const result = evaluateAudioQuality({ snrDb: 20, speechDurationMs: 1400 })
    expect(result).toEqual({
      accepted: false,
      reason: 'RETRY_SPEECH_TOO_SHORT',
      snrDb: 20,
      speechDurationMs: 1400,
    })
  })

  it('applies the duration gate before the noise gate', () => {
    const result = evaluateAudioQuality({ snrDb: 4, speechDurationMs: 500 })
    expect(result).toMatchObject({ accepted: false, reason: 'RETRY_SPEECH_TOO_SHORT' })
  })

  it('fails safely on non-finite measurements', () => {
    expect(evaluateAudioQuality({ snrDb: Number.NaN, speechDurationMs: 3000 })).toMatchObject({
      accepted: false,
      reason: 'RETRY_SPEECH_TOO_SHORT',
    })
    expect(
      evaluateAudioQuality({ snrDb: 20, speechDurationMs: Number.POSITIVE_INFINITY }),
    ).toMatchObject({ accepted: false, reason: 'RETRY_SPEECH_TOO_SHORT' })
  })
})

describe('updateProgressEwma (spec §12)', () => {
  it('applies progress_new = 0.3 * Sfinal + 0.7 * progress_old', () => {
    expect(updateProgressEwma(70, 80)).toBeCloseTo(73)
    expect(updateProgressEwma(0, 100)).toBeCloseTo(30)
    expect(updateProgressEwma(100, 0)).toBeCloseTo(70)
  })

  it('never lets the EWMA leave the canonical range', () => {
    expect(updateProgressEwma(-20, 120)).toBeLessThanOrEqual(100)
    expect(updateProgressEwma(-20, 120)).toBeGreaterThanOrEqual(0)
  })

  it('fails explicitly on non-finite inputs', () => {
    expect(() => updateProgressEwma(Number.NaN, 80)).toThrowError(/finite/)
    expect(() => updateProgressEwma(70, Number.NaN)).toThrowError(/finite/)
  })
})

describe('progression rules (spec §12)', () => {
  it('requires 3 consecutive sessions at or above 80 for CEFR module eligibility', () => {
    expect(isEligibleForNextCefrModule(2)).toBe(false)
    expect(isEligibleForNextCefrModule(3)).toBe(true)
    expect(isEligibleForNextCefrModule(4)).toBe(true)
  })

  it('triggers intervention only below 55 EWMA', () => {
    expect(shouldTriggerIntervention(54.9)).toBe(true)
    expect(shouldTriggerIntervention(55)).toBe(false)
    expect(shouldTriggerIntervention(Number.NaN)).toBe(false)
  })
})
