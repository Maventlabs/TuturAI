import { describe, expect, it } from 'vitest'
import {
  ACCENT_SUBSTITUTION_TABLE,
  ACCENT_VARIANT_WEIGHTS,
  CEFR_ESTIMATE_LABEL,
  CEFR_ESTIMATE_THRESHOLDS,
  DECISION_SCORING_VERSION,
  FLUENCY_WPM_LEARNER_TARGET,
  GRAMMAR_MIN_TOKENS_FOR_COMPLETE_STATUS,
  INTONATION_F0_MAX_HZ,
  INTONATION_F0_MIN_HZ,
  INTONATION_MIN_PITCH_POINTS,
  INTONATION_MIN_VOICED_MS,
  MATTR_WINDOW,
  METRIC_STATUS_VALUES,
  PER_MILD_SUBSTITUTION_WEIGHT,
  PER_MIN_MEAN_CONFIDENCE,
  PER_MIN_PHONEMES,
  PER_MIN_PHONEMES_FOR_ACCENT_DISCOUNT,
  PROVIDER_CONFIDENCE_GATE,
  SCORING_DECISION_LEDGER,
  TTR_NORM_FULL_SCALE,
  VOCAB_MIN_TOKENS,
  accentVariantWeight,
  classifyPhonemePair,
  computeMattr,
  estimateCefrBand,
  lemmatize,
  resolveGrammarMetricStatus,
  resolveMetricOutcome,
  scoreIntonationFromPitch,
  scorePronunciationFromAlignment,
  scoreVocabularyFromTranscript,
  tokenizeTranscript,
  type PronunciationAlignmentEvidence,
} from './scoring-decisions'
import { SCORING_VERSION } from './scoring-engine'

// ---------------------------------------------------------------------------
// Deterministic fixture helpers
// ---------------------------------------------------------------------------

function phoneme(expected: string, actual: string | null, confidence: number | null = null) {
  return { expected, actual, confidence }
}

function alignment(
  phonemes: Array<{ expected: string; actual: string | null; confidence: number | null }>,
): PronunciationAlignmentEvidence {
  return { words: [{ phonemes }] }
}

function repeated(count: number, make: (index: number) => { expected: string; actual: string | null; confidence: number | null }) {
  return Array.from({ length: count }, (_, index) => make(index))
}

/** 40 distinct pure-letter words (the tokenizer excludes digits by policy). */
const WORDS40 = Array.from(
  { length: 40 },
  (_, i) =>
    `${['ab','ac','ad','af','ag','ah','aj','ak','al','am'][i % 10]}${['eb','ec','ed','ef','eg','eh','ej','ek','el','em'][Math.floor(i / 10)]}`,
)

// ---------------------------------------------------------------------------
// Decision ledger integrity (spec §21)
// ---------------------------------------------------------------------------

describe('SCORING decision ledger (spec §21)', () => {
  it('covers exactly the nine human decision gate items', () => {
    expect(SCORING_DECISION_LEDGER).toHaveLength(9)
    expect(SCORING_DECISION_LEDGER.map((record) => record.id)).toEqual([
      'D1_PER_CALIBRATION',
      'D2_ACCENT_SUBSTITUTION_TABLE',
      'D3_WPM_RANGE',
      'D4_INTONATION_FORMULA',
      'D5_GRAMMAR_LENGTH_POLICY',
      'D6_TTR_NORMALIZATION',
      'D7_CEFR_VOCAB_LOOKUP',
      'D8_CEFR_THRESHOLD',
      'D9_MISSING_METRIC_POLICY',
    ])
  })

  it('labels every decision with a provenance from the evidence hierarchy and cites sources', () => {
    for (const record of SCORING_DECISION_LEDGER) {
      expect(['SCORING_MD_RULE', 'INDONESIA_RESEARCH', 'ASEAN_RESEARCH', 'INTERNATIONAL_RESEARCH', 'ENGINEERING_DECISION']).toContain(record.provenance)
      expect(record.primarySources.length).toBeGreaterThan(0)
      expect(record.decision.length).toBeGreaterThan(0)
    }
  })

  it('bumps the canonical scoring version to 2026.2 coherently across modules', () => {
    expect(DECISION_SCORING_VERSION).toBe('2026.2')
    expect(SCORING_VERSION).toBe('2026.2')
  })
})

// ---------------------------------------------------------------------------
// D9 — missing metric / confidence policy
// ---------------------------------------------------------------------------

describe('D9 resolveMetricOutcome (missing-metric/confidence policy, spec §10)', () => {
  it('prefers a canonical engine score whenever the engine could score', () => {
    expect(resolveMetricOutcome({ status: 'complete', score: 88 }, 70, 0.9)).toEqual({
      status: 'complete',
      score: 88,
      source: 'CANONICAL_ENGINE',
    })
    expect(resolveMetricOutcome({ status: 'partial', score: 55 }, 70, 0.9)).toMatchObject({ source: 'CANONICAL_ENGINE', score: 55 })
  })

  it('falls back to the provider estimate only when confidence meets the gate, keeping it labeled as fallback', () => {
    expect(resolveMetricOutcome(null, 72, 0.9)).toEqual({
      status: 'insufficient_evidence',
      score: 72,
      source: 'PROVIDER_ESTIMATE_FALLBACK',
    })
    expect(resolveMetricOutcome({ status: 'insufficient_evidence', score: null }, 72, 0.6)).toMatchObject({
      source: 'PROVIDER_ESTIMATE_FALLBACK',
      score: 72,
    })
  })

  it('never fabricates a score when confidence is missing or below the gate', () => {
    expect(resolveMetricOutcome(null, 72, null)).toMatchObject({ score: null, source: 'PROVIDER_ESTIMATE_FALLBACK' })
    expect(resolveMetricOutcome(null, 72, 0.59)).toMatchObject({ score: null })
    expect(resolveMetricOutcome(null, Number.NaN, 0.9)).toMatchObject({ score: null })
  })

  it('exposes the status vocabulary without silent zeros', () => {
    expect(METRIC_STATUS_VALUES).toEqual(['complete', 'partial', 'insufficient_evidence', 'failed'])
    expect(PROVIDER_CONFIDENCE_GATE).toBe(0.6)
  })
})

// ---------------------------------------------------------------------------
// D2 — accent substitution table
// ---------------------------------------------------------------------------

describe('D2 accent substitution table (spec §4.2, accent ≠ automatic error)', () => {
  it('classifies correct production as correct, not as an accent variant', () => {
    expect(classifyPhonemePair('v', 'v')).toBe('ACCEPTED_ACCENT_VARIATION')
    expect(accentVariantWeight('ACCEPTED_ACCENT_VARIATION')).toBe(0)
  })

  it('treats documented Indonesian/ASEAN intelligible variants leniently', () => {
    // Pan-ASEAN dental fricative realizations: accepted (weight 0)
    expect(classifyPhonemePair('θ', 't')).toBe('ACCEPTED_ACCENT_VARIATION')
    expect(classifyPhonemePair('ð', 'd')).toBe('ACCEPTED_ACCENT_VARIATION')
    // Highest-frequency Indonesian vowel substitution (12%): accepted
    expect(classifyPhonemePair('e', 'ɪ')).toBe('ACCEPTED_ACCENT_VARIATION')
    expect(accentVariantWeight('MILD_PENALTY')).toBe(PER_MILD_SUBSTITUTION_WEIGHT)
  })

  it('applies reduced penalties to mild clarity-reducing substitutions inside the 10–15% band', () => {
    expect(PER_MILD_SUBSTITUTION_WEIGHT).toBe(0.85)
    expect(classifyPhonemePair('v', 'f')).toBe('MILD_PENALTY')
    expect(classifyPhonemePair('z', 's')).toBe('MILD_PENALTY')
    expect(classifyPhonemePair('ʃ', 's')).toBe('MILD_PENALTY')
    expect(classifyPhonemePair('ʤ', 'd')).toBe('MILD_PENALTY')
    expect(classifyPhonemePair('f', 'p')).toBe('MILD_PENALTY')
  })

  it('treats materially distorting realizations and deletions as full errors', () => {
    expect(classifyPhonemePair('v', 'p')).toBe('FULL_ERROR')
    expect(classifyPhonemePair('s', null)).toBe('FULL_ERROR') // cluster simplification
    expect(classifyPhonemePair('k', 't')).toBe('FULL_ERROR') // undocumented substitution
    expect(accentVariantWeight('FULL_ERROR')).toBe(1)
  })

  it('matches rules on normalized IPA so stress/length marks never create phantom errors', () => {
    expect(classifyPhonemePair('ˈv', 'fː')).toBe('MILD_PENALTY')
    expect(classifyPhonemePair('θ.', 't')).toBe('ACCEPTED_ACCENT_VARIATION')
  })

  it('documents every table entry with rationale, provenance, and source', () => {
    for (const rule of ACCENT_SUBSTITUTION_TABLE) {
      expect(rule.rationale.length).toBeGreaterThan(20)
      expect(['SCORING_MD_RULE', 'INDONESIA_RESEARCH', 'ASEAN_RESEARCH', 'INTERNATIONAL_RESEARCH', 'ENGINEERING_DECISION']).toContain(rule.provenance)
      expect(rule.source.length).toBeGreaterThan(3)
    }
    expect(ACCENT_VARIANT_WEIGHTS).toEqual({ ACCEPTED_ACCENT_VARIATION: 0, MILD_PENALTY: 0.85, FULL_ERROR: 1 })
  })
})

// ---------------------------------------------------------------------------
// D1 — PER calibration
// ---------------------------------------------------------------------------

describe('D1 scorePronunciationFromAlignment (PER calibration, spec §4)', () => {
  it('scores a fully correct alignment at 100', () => {
    const evidence = alignment(repeated(24, (index) => phoneme(`p${index}`, `p${index}`)))
    const result = scorePronunciationFromAlignment(evidence)
    expect(result.status).toBe('complete')
    expect(result.score).toBe(100)
    expect(result.rawMetrics.calibratedPer).toBe(0)
  })

  it('applies the accent discount: mild variants cost 0.85, accepted variants cost 0', () => {
    // 24 phonemes: 20 correct, 2 mild (v→f), 2 accepted (θ→t)
    const phonemes = repeated(24, (index) => {
      if (index === 0) return phoneme('v', 'f')
      if (index === 1) return phoneme('v', 'f')
      if (index === 2) return phoneme('θ', 't')
      if (index === 3) return phoneme('ð', 'd')
      return phoneme(`k${index}`, `k${index}`)
    })
    const result = scorePronunciationFromAlignment(phonemes.length ? alignment(phonemes) : alignment([]))
    // E_w = 2*0.85 = 1.7; PER_cal = 1.7/24 ≈ 0.0708333; Sp = 100*(1-PER) ≈ 92.9167
    expect(result.score).toBeCloseTo(100 * (1 - 1.7 / 24), 6)
    expect(result.rawMetrics.acceptedAccentVariants).toBe(2)
    expect(result.rawMetrics.mildPenaltyVariants).toBe(2)
    expect(result.rawMetrics.rawPer).toBeCloseTo(2 / 24, 9) // plain (S+D)/N
    expect(result.rawMetrics.calibratedPer).toBeCloseTo(1.7 / 24, 9) // accent-calibrated E_w/N
  })

  it('keeps full errors at full weight and counts deletions as full errors', () => {
    // 24 phonemes: 2 deletions (cluster simplification), 1 full substitution, 21 correct
    const phonemes = repeated(24, (index) => {
      if (index === 0) return phoneme('s', null)
      if (index === 1) return phoneme('t', null)
      if (index === 2) return phoneme('k', 't')
      return phoneme(`m${index}`, `m${index}`)
    })
    const result = scorePronunciationFromAlignment(alignment(phonemes))
    expect(result.score).toBeCloseTo(100 * (1 - 3 / 24), 6)
    expect(result.rawMetrics.deletions).toBe(2)
    expect(result.rawMetrics.fullErrors).toBe(3)
  })

  it('keeps the accent discount on thin-but-scoreable samples but flags them partial (8..19 phonemes)', () => {
    // 10 phonemes, 1 mild variant: rawPer = 1/10, PER_cal = 0.85/10
    const phonemes = repeated(10, (index) => (index === 0 ? phoneme('v', 'f') : phoneme(`b${index}`, `b${index}`)))
    const result = scorePronunciationFromAlignment(alignment(phonemes))
    expect(result.status).toBe('partial')
    expect(result.rawMetrics.rawPer).toBeCloseTo(0.1, 9)
    expect(result.rawMetrics.calibratedPer).toBeCloseTo(0.085, 9)
    expect(result.score).toBeCloseTo(91.5, 6)
  })

  it('reports insufficient evidence below the minimum phoneme count instead of inventing a score', () => {
    const result = scorePronunciationFromAlignment(alignment(repeated(PER_MIN_PHONEMES - 1, (i) => phoneme(`k${i}`, `k${i}`))))
    expect(result.status).toBe('insufficient_evidence')
    expect(result.score).toBeNull()
    expect(result.rawMetrics.targetPhonemes).toBe(PER_MIN_PHONEMES - 1)
  })

  it('rejects alignment whose mean confidence is below the reliability gate', () => {
    const phonemes = repeated(24, (i) => phoneme(`k${i}`, `k${i}`, 0.4))
    const result = scorePronunciationFromAlignment(alignment(phonemes))
    expect(result.status).toBe('insufficient_evidence')
    expect(result.score).toBeNull()
    expect(result.rawMetrics.meanConfidence).toBeCloseTo(0.4)
  })

  it('excludes individual low-confidence phonemes from both the denominator and the error sum', () => {
    // 24 confident + 6 unconfident (0.2) erroneous phonemes → the 6 are gated out
    const phonemes = repeated(30, (index) =>
      index >= 24 ? phoneme('z', 's', 0.2) : phoneme(`g${index}`, `g${index}`, 0.95),
    )
    const result = scorePronunciationFromAlignment(alignment(phonemes))
    expect(result.rawMetrics.targetPhonemes).toBe(24)
    expect(result.rawMetrics.belowConfidenceCount).toBe(6)
    expect(result.score).toBe(100)
  })

  it('treats the one-to-one provider contract honestly: insertions are unobservable and reported as 0', () => {
    const result = scorePronunciationFromAlignment(alignment(repeated(24, (i) => phoneme(`d${i}`, `d${i}`))))
    expect(result.rawMetrics.insertions).toBe(0)
    expect(result.rawMetrics.rawPer).toBe(0)
  })

  it('fails explicitly on malformed evidence instead of silently dropping it', () => {
    expect(() => scorePronunciationFromAlignment(undefined as unknown as PronunciationAlignmentEvidence)).toThrowError(/words/)
    expect(() =>
      scorePronunciationFromAlignment({ words: [{ phonemes: [{ expected: '', actual: 'k', confidence: null }] }] }),
    ).toThrowError(/expected/)
    expect(() =>
      scorePronunciationFromAlignment({ words: [{ phonemes: [{ expected: 'k', actual: 5 as unknown as string, confidence: null }] }] }),
    ).toThrowError(/actual/)
    expect(() =>
      scorePronunciationFromAlignment({ words: [{ phonemes: [{ expected: 'k', actual: 'k', confidence: 1.4 }] }] }),
    ).toThrowError(/confidence/)
  })

  it('exposes the calibration constants for audit', () => {
    expect(PER_MIN_PHONEMES).toBe(8)
    expect(PER_MIN_PHONEMES_FOR_ACCENT_DISCOUNT).toBe(20)
    expect(PER_MIN_MEAN_CONFIDENCE).toBe(0.6)
  })
})

// ---------------------------------------------------------------------------
// D6 — TTR normalization (MATTR)
// ---------------------------------------------------------------------------

describe('D6 MATTR and vocabulary normalization (Covington & McFall 2010)', () => {
  it('computes raw TTR fallback for samples within one window', () => {
    const tokens = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c', 'd']
    expect(computeMattr(tokens, MATTR_WINDOW)).toBeCloseTo(4 / 10)
  })

  it('computes the moving-average TTR across all windows for long samples', () => {
    // Window 2 over [a,b,a,b]: windows (a,b)=1.0, (b,a)=1.0, (a,b)=1.0 → 1.0
    expect(computeMattr(['a', 'b', 'a', 'b'], 2)).toBeCloseTo(1)
    // Window 2 over [a,a,b,b]: (a,a)=0.5, (a,b)=1.0, (b,b)=0.5 → 2/3
    expect(computeMattr(['a', 'a', 'b', 'b'], 2)).toBeCloseTo(2 / 3)
  })

  it('guards empty samples and invalid windows without dividing by zero', () => {
    expect(computeMattr([], MATTR_WINDOW)).toBe(0)
    expect(computeMattr(['a'], 0)).toBe(0)
  })

  it('requires a minimum token count and reports insufficient evidence below it', () => {
    const short = scoreVocabularyFromTranscript(tokenizeTranscript('the cat sat').join(' '))
    expect(short.status).toBe('insufficient_evidence')
    expect(short.score).toBeNull()
    const exactly = scoreVocabularyFromTranscript(
      Array.from({ length: VOCAB_MIN_TOKENS - 1 }, (_, i) => `word${i}`).join(' '),
    )
    expect(exactly.status).toBe('insufficient_evidence')
  })

  it('keeps the raw TTR fallback partial for 30..50-token samples and MATTR complete beyond the window', () => {
    const midSample = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 'cat' : 'dog')).join(' ')
    const mid = scoreVocabularyFromTranscript(midSample)
    expect(mid.status).toBe('partial')
    expect(mid.rawMetrics.ttrNormInput).toBeCloseTo(mid.rawMetrics.rawTtr ?? -1, 9)
    expect(mid.rawMetrics.mattr).toBeCloseTo(mid.rawMetrics.rawTtr ?? -1, 9)

    const longSample = Array.from({ length: MATTR_WINDOW + 10 }, (_, i) => WORDS40[i % 30]).join(' ')
    const long = scoreVocabularyFromTranscript(longSample)
    expect(long.status).toBe('complete')
    expect(long.rawMetrics.mattr).not.toBeNull()
    expect(long.rawMetrics.ttrNormInput).toBeCloseTo(long.rawMetrics.mattr ?? -1, 9)
  })

  it('scales diversity against TTR_NORM_FULL_SCALE so realistic conversation reaches the upper band', () => {
    expect(TTR_NORM_FULL_SCALE).toBe(0.5)
    // MATTR 0.5+ → full diversity contribution (40 distinct words cycling over 60 tokens)
    const longSample = Array.from({ length: 60 }, (_, i) => WORDS40[i % 40]).join(' ')
    const result = scoreVocabularyFromTranscript(longSample)
    expect(result.rawMetrics.ttrNormInput).toBeGreaterThanOrEqual(0.5)
    expect(result.score).toBeGreaterThanOrEqual(50)
  })

  it('excludes numbers from tokens per the documented tokenization policy', () => {
    expect(tokenizeTranscript('I have 2 cats and 10 dogs')).toEqual(['i', 'have', 'cats', 'and', 'dogs'])
    expect(lemmatize('cats')).toBe('cat')
    expect(lemmatize('studies')).toBe('study')
    expect(lemmatize('walking')).toBe('walk')
    expect(lemmatize('stopped')).toBe('stop')
  })
})

// ---------------------------------------------------------------------------
// D7 — CEFR vocabulary lookup
// ---------------------------------------------------------------------------

describe('D7 CEFR vocabulary lookup (NGSL-core + documented fallback policy)', () => {
  it('scores high-frequency speech near full coverage and keeps unknown words neutral', () => {
    const hfSentence = Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? 'beautiful' : ['the', 'teacher', 'explained', 'the'][i % 4])).join(' ')
    const result = scoreVocabularyFromTranscript(hfSentence)
    expect(result.rawMetrics.cefrVocabScore).toBeGreaterThan(80)
    expect(result.rawMetrics.tokenClasses.highFrequency).toBeGreaterThan(30)

    const unknownHeavy = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 'quixotic' : 'perspicacious')).join(' ')
    const unknownResult = scoreVocabularyFromTranscript(unknownHeavy)
    expect(unknownResult.rawMetrics.tokenClasses.unknown).toBe(40)
    // Unknown words are neutral: excluded from the coverage numerator, never errors.
    expect(unknownResult.rawMetrics.cefrVocabScore).toBe(0)
  })

  it('handles inflections through the documented lemmatization', () => {
    const sentence = Array.from({ length: 36 }, (_, i) =>
      i % 3 === 0 ? 'teachers' : i % 3 === 1 ? 'studied' : 'lessons',
    ).join(' ')
    const result = scoreVocabularyFromTranscript(sentence)
    expect(result.rawMetrics.tokenClasses.highFrequency).toBe(36)
  })

  it('treats proper nouns neutrally and excludes them from the coverage denominator', () => {
    const parts: string[] = ['school']
    for (let i = 0; i < 12; i += 1) parts.push('Jakarta') // mid-sentence capitalized → proper noun
    for (let i = 0; i < 23; i += 1) parts.push('school')
    const result = scoreVocabularyFromTranscript(parts.join(' '))
    expect(result.rawMetrics.tokenClasses.properNoun).toBe(12)
    // Proper nouns excluded from both sides: coverage = 24/24 = 100%
    expect(result.rawMetrics.cefrVocabScore).toBe(100)
  })

  it('bands beyond-core lexical diversity into labeled CEFR estimates only', () => {
    expect(CEFR_ESTIMATE_LABEL).toContain('not an official CEFR certification')
    const richWords = ['serendipitous', 'mellifluous', 'quixotic', 'perspicacious', 'ephemeral']
    const rich = Array.from({ length: 60 }, (_, i) => richWords[i % richWords.length]).join(' ')
    const result = scoreVocabularyFromTranscript(rich)
    expect(result.rawMetrics.estimatedCefrBand).toBe('B2')
    expect(result.rawMetrics.cefrBandingLabel).toBe(CEFR_ESTIMATE_LABEL)
  })

  it('fails explicitly when the transcript evidence is not a string', () => {
    expect(() => scoreVocabularyFromTranscript(42 as unknown as string)).toThrowError(/string/)
  })
})

// ---------------------------------------------------------------------------
// D8 — CEFR estimate thresholds
// ---------------------------------------------------------------------------

describe('D8 CEFR estimate banding (labeled estimate, never certification)', () => {
  it('applies the documented thresholds to overall scores', () => {
    expect(CEFR_ESTIMATE_THRESHOLDS).toEqual({ B1: 70, B2: 85 })
    expect(estimateCefrBand(69.9)).toBe('A1-A2')
    expect(estimateCefrBand(70)).toBe('B1')
    expect(estimateCefrBand(84.9)).toBe('B1')
    expect(estimateCefrBand(85)).toBe('B2')
    expect(estimateCefrBand(100)).toBe('B2')
  })

  it('fails explicitly on non-finite input', () => {
    expect(() => estimateCefrBand(Number.NaN)).toThrowError(/finite/)
  })
})

// ---------------------------------------------------------------------------
// D3 — WPM range
// ---------------------------------------------------------------------------

describe('D3 WPM normalization range (spec §5.2 conflict resolution)', () => {
  it('documents the 70–110 learner band as a target, not the normalization', () => {
    expect(FLUENCY_WPM_LEARNER_TARGET).toEqual({ min: 70, max: 110 })
  })
})

// ---------------------------------------------------------------------------
// D5 — grammar length policy
// ---------------------------------------------------------------------------

describe('D5 grammar length policy (spec §7.3 approval to keep the flat rule)', () => {
  it('downgrades only the status for thin samples, never the score', () => {
    expect(resolveGrammarMetricStatus(GRAMMAR_MIN_TOKENS_FOR_COMPLETE_STATUS)).toBe('complete')
    expect(resolveGrammarMetricStatus(GRAMMAR_MIN_TOKENS_FOR_COMPLETE_STATUS - 1)).toBe('partial')
    expect(resolveGrammarMetricStatus(0)).toBe('partial')
    expect(resolveGrammarMetricStatus(500)).toBe('complete')
  })

  it('fails explicitly on invalid token counts', () => {
    expect(() => resolveGrammarMetricStatus(-1)).toThrowError(/non-negative/)
    expect(() => resolveGrammarMetricStatus(Number.NaN)).toThrowError(/non-negative/)
  })
})

// ---------------------------------------------------------------------------
// D4 — intonation formula
// ---------------------------------------------------------------------------

function flatPitch(points: number, f0Hz: number) {
  return Array.from({ length: points }, (_, index) => ({ timeMs: index * 100, f0Hz }))
}

function variedPitch(points: number, lowHz: number, highHz: number) {
  return Array.from({ length: points }, (_, index) => ({
    timeMs: index * 100,
    f0Hz: index % 2 === 0 ? lowHz : highHz,
  }))
}

describe('D4 scoreIntonationFromPitch (spec §6, normalized measures only)', () => {
  it('rewards expressive pitch variation over flat regional intonation without absolute Hz thresholds', () => {
    const flat = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: flatPitch(20, 120) })
    expect(flat.status).toBe('complete')
    expect(flat.score).toBe(0)
    expect(flat.rawMetrics.pitchVariationSemitones).toBeCloseTo(0)

    // ±3 st swing around the same median range (110↔220 Hz ≈ 12 st swing)
    const lively = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: variedPitch(20, 110, 220) })
    expect(lively.status).toBe('complete')
    expect(lively.score).toBeGreaterThan(flat.score ?? 0)
    expect(lively.rawMetrics.pitchVariationSemitones).toBeCloseTo(12, 5)
  })

  it('applies the exact formula Si = 0.6*varNorm + 0.4*slopeNorm', () => {
    // 110↔220 Hz alternating: variation ≈ 12 st → varNorm clamps to 1; median |Δst| ≈ 12 → slopeNorm clamps to 1
    const result = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: variedPitch(20, 110, 220) })
    expect(result.score).toBeCloseTo(100, 3)

    // 200↔220 Hz: Δ ≈ 1.658 st → variation ≈ 1.658, median slope ≈ 1.658
    // varNorm = (1.658-1)/9 ≈ 0.0731; slopeNorm = 1.658/1.5 (clamped 1) → Si ≈ 0.6*0.0731+0.4 = 44.4
    const small = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: variedPitch(20, 200, 220) })
    const variation = 12 * Math.log2(220 / 200)
    const expected = (0.6 * Math.min(1, Math.max(0, (variation - 1) / 9)) + 0.4) * 100
    expect(small.score).toBeCloseTo(expected, 3)
  })

  it('reports insufficient evidence for too few pitch points or too-short voiced duration', () => {
    const few = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: flatPitch(INTONATION_MIN_PITCH_POINTS - 1, 150) })
    expect(few.status).toBe('insufficient_evidence')
    expect(few.score).toBeNull()

    const short = scoreIntonationFromPitch({ voicedDurationMs: INTONATION_MIN_VOICED_MS - 1, pitchPoints: flatPitch(20, 150) })
    expect(short.status).toBe('insufficient_evidence')
    expect(short.score).toBeNull()
  })

  it('excludes physiologically invalid F0 samples instead of scoring noise', () => {
    const points = [...flatPitch(10, 150), ...flatPitch(5, 20), ...flatPitch(5, 900)]
    const result = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: points })
    expect(result.rawMetrics.pitchPointCount).toBe(10)
    expect(result.status).toBe('complete')
    expect(result.rawMetrics.pitchVariationSemitones).toBeCloseTo(0, 5)
    expect(INTONATION_F0_MIN_HZ).toBe(50)
    expect(INTONATION_F0_MAX_HZ).toBe(500)
  })

  it('sorts out-of-order samples by timestamp before computing the contour', () => {
    const points = [
      { timeMs: 300, f0Hz: 220 },
      { timeMs: 100, f0Hz: 110 },
      { timeMs: 200, f0Hz: 220 },
      { timeMs: 400, f0Hz: 110 },
      { timeMs: 500, f0Hz: 220 },
    ]
    const result = scoreIntonationFromPitch({ voicedDurationMs: 4000, pitchPoints: points })
    expect(result.status).toBe('complete')
    expect(result.rawMetrics.pitchVariationSemitones).toBeCloseTo(12, 5)
  })

  it('fails explicitly on malformed pitch evidence', () => {
    expect(() => scoreIntonationFromPitch(undefined as unknown as { pitchPoints: [] })).toThrowError(/pitchPoints/)
    expect(() =>
      scoreIntonationFromPitch({ voicedDurationMs: -5, pitchPoints: flatPitch(10, 150) }),
    ).toThrowError(/voicedDurationMs/)
  })
})
