// ---------------------------------------------------------------------------
// SCORING HUMAN DECISION GATE — resolved canonical decisions (SCORING_SPEC §21)
// Scoring version: 2026.2
//
// Every rule below carries an explicit provenance label from the evidence
// hierarchy (highest authority first):
//   SCORING_MD_RULE          — the TuturAI Scoring MD/spec specifies it; implemented as written
//   INDONESIA_RESEARCH       — peer-reviewed Indonesian EFL evidence
//   ASEAN_RESEARCH           — peer-reviewed Southeast Asian English evidence
//   INTERNATIONAL_RESEARCH   — established international assessment research
//   ENGINEERING_DECISION     — engineering judgment where no authoritative evidence exists
//
// Design invariants (SCORING_SPEC §10, §13):
//   - All functions are deterministic (no Date.now, no Math.random).
//   - Missing/insufficient evidence NEVER becomes a fabricated score; the
//     MetricStatus model reports it explicitly.
//   - Invalid input shapes fail explicitly (throw) instead of defaulting.
//   - Providers produce raw evidence; this module produces scores.
// ---------------------------------------------------------------------------

import type { DimensionScoreSource, MetricStatus } from './types'

export type { DimensionScoreSource, MetricStatus }

/** Provenance labels for every rule in this module. */
export type EvidenceProvenance =
  | 'SCORING_MD_RULE'
  | 'INDONESIA_RESEARCH'
  | 'ASEAN_RESEARCH'
  | 'INTERNATIONAL_RESEARCH'
  | 'ENGINEERING_DECISION'

export const DECISION_SCORING_VERSION = '2026.2'

// ===========================================================================
// DECISION 9 (policy core) — Missing metric / confidence status model
// ===========================================================================
// SCORING_MD_RULE: spec §10 — "Invalid required inputs must fail explicitly
// rather than silently defaulting to a plausible score"; missing metrics must
// be guarded, never silently converted to zero.
// ENGINEERING_DECISION: the concrete state vocabulary below.

/**
 * Lifecycle status of one canonical metric's evidence.
 * - `complete`              — sufficient structured evidence; engine score canonical.
 * - `partial`               — engine score computed, but the sample is thin; usable, flagged.
 * - `insufficient_evidence` — engine cannot score (below minimum sample/confidence);
 *                             a labeled provider estimate may stand in for compatibility,
 *                             never presented as engine-computed.
 * - `failed`                — evidence exists but is corrupt/inconsistent; fail explicitly.
 * `pending` is a pre-scoring state owned by the session pipeline, not by this engine.
 */
export const METRIC_STATUS_VALUES = ['complete', 'partial', 'insufficient_evidence', 'failed'] as const

/** Provider confidence below this threshold is not strong enough to stand in for missing engine evidence. */
export const PROVIDER_CONFIDENCE_GATE = 0.6

export interface CanonicalMetricOutcome {
  status: MetricStatus
  /** Canonical 0..100 score, or null when no score can honestly be produced. */
  score: number | null
  source: DimensionScoreSource
}

export interface MetricEngineResult {
  status: MetricStatus
  score: number | null
}

/**
 * DECISION 9 — resolve one dimension's canonical outcome.
 *
 * Rules:
 * 1. Engine evidence scored (complete|partial) → CANONICAL_ENGINE, score used.
 * 2. Engine evidence insufficient/failed → the provider estimate stands in ONLY
 *    when provider confidence is present and >= PROVIDER_CONFIDENCE_GATE; status
 *    is downgraded to `insufficient_evidence` and the source labeled
 *    PROVIDER_ESTIMATE_FALLBACK so it can never masquerade as canonical.
 * 3. No estimate, or confidence below the gate → score null. A null score is
 *    never converted to 0 downstream.
 */
export function resolveMetricOutcome(
  engineResult: MetricEngineResult | null,
  providerEstimate: number | null,
  providerConfidence: number | null,
): CanonicalMetricOutcome {
  if (engineResult && engineResult.score !== null) {
    return { status: engineResult.status, score: engineResult.score, source: 'CANONICAL_ENGINE' }
  }
  const hasEstimate = providerEstimate !== null && Number.isFinite(providerEstimate)
  const hasConfidence =
    providerConfidence !== null && Number.isFinite(providerConfidence) && providerConfidence >= PROVIDER_CONFIDENCE_GATE
  if (hasEstimate && hasConfidence) {
    return { status: 'insufficient_evidence', score: providerEstimate, source: 'PROVIDER_ESTIMATE_FALLBACK' }
  }
  return { status: 'insufficient_evidence', score: null, source: 'PROVIDER_ESTIMATE_FALLBACK' }
}

// ===========================================================================
// DECISION 1 — PER calibration  (SCORING-003)
// ===========================================================================
// SCORING_MD_RULE (spec §4.1): PER = (S + D + I) / N over target phonemes and
// Sp = 100 * (1 - PER_calibrated).
// SCORING_MD_RULE (spec §4.2): intelligible Indonesian-accent substitutions
// receive a lighter penalty of approximately 10–15% instead of full error weight.
// INTERNATIONAL_RESEARCH: PER=(S+D+I)/N is the standard forced-alignment
// pronunciation-scoring error metric (El Kheir et al. 2023, arXiv:2310.13974).
// Kadambi 2024 shows forced-alignment errors distort automatic scores — hence
// the per-phoneme confidence gating below.
// ENGINEERING_DECISION: exact weight 0.85 inside the source's 10–15% band.

/** Accent-variation discount: a MILD_PENALTY substitution counts as 0.85 of a full error. */
export const PER_MILD_SUBSTITUTION_WEIGHT = 0.85
/** Minimum ungated target phonemes before the accent discount is statistically meaningful. */
export const PER_MIN_PHONEMES_FOR_ACCENT_DISCOUNT = 20
/** Minimum ungated target phonemes for ANY canonical pronunciation score. */
export const PER_MIN_PHONEMES = 8
/** Mean phoneme confidence below this value makes the alignment evidence unreliable. */
export const PER_MIN_MEAN_CONFIDENCE = PROVIDER_CONFIDENCE_GATE

// ===========================================================================
// DECISION 2 — Indonesian/ASEAN accent substitution table  (SCORING-003)
// ===========================================================================
// NOT a global "Indonesian accent = ignore errors" policy. Three classes:
//  - ACCEPTED_ACCENT_VARIATION — widely shared Indonesian/ASEAN realization with
//    no evidence of material intelligibility harm → weight 0.
//  - MILD_PENALTY              — common realization that measurably erodes
//    clarity in specific contexts → weight 0.85 (inside the spec §4.2 band).
//  - FULL_ERROR                — everything else, including deletions and
//    cluster simplification that removes whole segments → weight 1.
// Rules are matched on the (normalized) expected-target/realized pair — i.e.
// keyed to the TARGET phonological context, not position-in-word heuristics.

export type AccentVariantClassification = 'ACCEPTED_ACCENT_VARIATION' | 'MILD_PENALTY' | 'FULL_ERROR'

export interface AccentSubstitutionRule {
  /** Expected (target) IPA symbol or sequence. */
  expected: string
  /** Realized IPA symbol or sequence, or null for deletions. */
  actual: string | null
  classification: AccentVariantClassification
  rationale: string
  provenance: EvidenceProvenance
  source: string
}

/**
 * Table entries are matched on normalized IPA (stress marks, length marks, and
 * syllable dots stripped).
 *
 * Sources:
 * - Language Literacy (UISU) 2021: Indonesian EFL substitution rates —
 *   /ʤ/→[d] 2%, /e/→[ɪ]-type vowel substitution 12%, /v/→[f] 2%.
 * - Syam 2024 (MDPI Languages 9(6):222): voiceless labiodental /f/ realized
 *   ~100% consistently by Indonesian learners; IAE deviations are largely
 *   predictable and frequently intelligible (Derwing & Munro 1997: accented ≠
 *   unintelligible).
 * - IJSSH 409-CH346: final-consonant-cluster simplification IS the Indonesian
 *   feature that materially affects intelligibility → FULL_ERROR.
 * - ASEAN English research (Deterding & Kirkpatrick 2006): shared features such
 *   as /θ/→/t/, /ð/→/d/, lax-vowel mergers rarely cause communication breakdown.
 */
export const ACCENT_SUBSTITUTION_TABLE: readonly AccentSubstitutionRule[] = [
  {
    expected: 'v',
    actual: 'f',
    classification: 'MILD_PENALTY',
    rationale: 'Labiodental fricative merger /v/→[f] ("very"→"fery") is frequent in Indonesian English; minimal-pair load is low but not zero (very/ferry), so a reduced penalty inside the spec 10–15% band applies.',
    provenance: 'INDONESIA_RESEARCH',
    source: 'Language Literacy (UISU) 2021; Syam 2024',
  },
  {
    expected: 'z',
    actual: 's',
    classification: 'MILD_PENALTY',
    rationale: 'Voiced alveolar fricative /z/→[s] ("zoo"→"su") is a shared Indonesian/ASEAN realization; voicing contrasts carry low lexical load in context but are not free.',
    provenance: 'INDONESIA_RESEARCH',
    source: 'Language Literacy (UISU) 2021; Deterding & Kirkpatrick 2006 (ASEAN)',
  },
  {
    expected: 'ʃ',
    actual: 's',
    classification: 'MILD_PENALTY',
    rationale: '/ʃ/→[s] ("ship"→"sip") is a shared regional realization; place merger without segment deletion, mildly clarity-reducing.',
    provenance: 'ASEAN_RESEARCH',
    source: 'Deterding & Kirkpatrick 2006; Language Literacy (UISU) 2021',
  },
  {
    expected: 'θ',
    actual: 't',
    classification: 'ACCEPTED_ACCENT_VARIATION',
    rationale: 'Dental fricative /θ/→[t] ("think"→"tink") is a pan-ASEAN feature with negligible breakdown evidence in context; minimal pairs are rare.',
    provenance: 'ASEAN_RESEARCH',
    source: 'Deterding & Kirkpatrick 2006',
  },
  {
    expected: 'ð',
    actual: 'd',
    classification: 'ACCEPTED_ACCENT_VARIATION',
    rationale: '/ð/→[d] ("this"→"dis") is a pan-ASEAN feature; highly predictable and rarely obstructs intelligibility.',
    provenance: 'ASEAN_RESEARCH',
    source: 'Deterding & Kirkpatrick 2006',
  },
  {
    expected: 'e',
    actual: 'ɪ',
    classification: 'ACCEPTED_ACCENT_VARIATION',
    rationale: 'Lax-vowel merger /e/→[ɪ] in closed contexts (the highest-frequency Indonesian vowel substitution, 12% of observed substitutions) is largely intelligible in running speech.',
    provenance: 'INDONESIA_RESEARCH',
    source: 'Language Literacy (UISU) 2021',
  },
  {
    expected: 'ʤ',
    actual: 'd',
    classification: 'MILD_PENALTY',
    rationale: '/ʤ/→[d] ("jam"→"dam") is documented (2% of observed substitutions) and can collide with minimal pairs; reduced penalty rather than full error.',
    provenance: 'INDONESIA_RESEARCH',
    source: 'Language Literacy (UISU) 2021',
  },
  {
    expected: 'f',
    actual: 'p',
    classification: 'MILD_PENALTY',
    rationale: 'Place shift /f/→[p] ("fan"→"pan") occurs where labiodental articulation is unstable; Syam 2024 shows /f/ is otherwise ~100% consistent, so residual shifts are treated as mild.',
    provenance: 'INDONESIA_RESEARCH',
    source: 'Syam 2024 (MDPI Languages 9(6):222)',
  },
  {
    expected: 'v',
    actual: 'p',
    classification: 'FULL_ERROR',
    rationale: '/v/→[p] removes both voicing and frication ("vet"→"pet"); materially distorting.',
    provenance: 'ENGINEERING_DECISION',
    source: 'Derived from Syam 2024 fricative contrast analysis',
  },
  {
    expected: 's',
    actual: null,
    classification: 'FULL_ERROR',
    rationale: 'Deletion of final fricative (incl. plural/3rd-person marking) removes grammatical information — cluster simplification is the Indonesian feature with documented intelligibility impact.',
    provenance: 'INDONESIA_RESEARCH',
    source: 'IJSSH 409-CH346 (cluster simplification)',
  },
]

/** IPA normalization: strips stress marks, length marks, syllable dots, and whitespace. */
export function normalizeIpa(symbol: string): string {
  return symbol.replace(/[ˈˌː.]/g, '').trim()
}

/**
 * DECISION 2 — classify one expected/actual phoneme pair.
 * Identical normalized symbols are correct production (not an accent variant).
 * Null actual = deletion = FULL_ERROR unless a table rule reclassifies it.
 */
export function classifyPhonemePair(expected: string, actual: string | null): AccentVariantClassification {
  if (actual === null || actual === undefined) return 'FULL_ERROR' // deletion
  const normExpected = normalizeIpa(expected)
  const normActual = normalizeIpa(actual)
  if (normExpected === normActual) return 'ACCEPTED_ACCENT_VARIATION' // correct production
  const rule = ACCENT_SUBSTITUTION_TABLE.find(
    (candidate) =>
      normalizeIpa(candidate.expected) === normExpected
      && candidate.actual !== null
      && normalizeIpa(candidate.actual) === normActual,
  )
  return rule ? rule.classification : 'FULL_ERROR'
}

/** Error weight for a classified pair (0 accepted variant, 0.85 mild, 1 full error). */
export const ACCENT_VARIANT_WEIGHTS: Readonly<Record<AccentVariantClassification, number>> = {
  ACCEPTED_ACCENT_VARIATION: 0,
  MILD_PENALTY: PER_MILD_SUBSTITUTION_WEIGHT,
  FULL_ERROR: 1,
} as const

/** Error weight for a classified pair. */
export function accentVariantWeight(classification: AccentVariantClassification): number {
  return ACCENT_VARIANT_WEIGHTS[classification]
}

export interface PronunciationAlignmentPhoneme {
  expected: string
  actual: string | null
  confidence: number | null
}

export interface PronunciationAlignmentEvidence {
  /** Word-level forced alignment; every phoneme carries its expected target symbol. */
  words: ReadonlyArray<{ phonemes: ReadonlyArray<PronunciationAlignmentPhoneme> }>
}

export interface PronunciationScoreResult {
  status: MetricStatus
  /** Canonical Sp ∈ [0,100] or null when evidence is insufficient. */
  score: number | null
  rawMetrics: {
    targetPhonemes: number
    substitutions: number
    deletions: number
    /** Provider contract is one-to-one alignment, so true insertions are unobservable; documented as 0. */
    insertions: number
    acceptedAccentVariants: number
    mildPenaltyVariants: number
    fullErrors: number
    rawPer: number | null
    calibratedPer: number | null
    meanConfidence: number | null
    belowConfidenceCount: number
  }
}

/**
 * DECISION 1 — canonical pronunciation score from forced alignment.
 *
 *   rawPer     = (S + D) / N'                              (plain, unweighted)
 *   E_w        = Σ weight(classify(expected_i, actual_i))  (accent-calibrated)
 *   PER_cal    = clamp(E_w / N', 0, 1)
 *   Sp         = 100 * (1 - PER_cal)                       (SCORING_MD_RULE §4.1)
 *
 * The spec §4.2 accent discount applies at ANY scoreable sample size (the MD
 * rule is not sample-size-conditional); thin samples (N' < 20) keep it but are
 * flagged `partial` instead of `complete`.
 * Insufficient-evidence conditions (never scored, never zeroed):
 *   - fewer than PER_MIN_PHONEMES gated target phonemes;
 *   - mean per-phoneme confidence (when any confidence is reported) below
 *     PER_MIN_MEAN_CONFIDENCE (Kadambi 2024: unreliable alignment corrupts PER).
 * Individual phonemes reporting confidence < PER_MIN_MEAN_CONFIDENCE are
 * excluded from both N' and the error sum (their labels are unreliable).
 * Malformed input shapes throw explicitly (spec §10).
 */
export function scorePronunciationFromAlignment(evidence: PronunciationAlignmentEvidence): PronunciationScoreResult {
  if (!evidence || !Array.isArray(evidence.words)) {
    throw new Error('Pronunciation evidence invalid: words must be an array')
  }

  const phonemes: PronunciationAlignmentPhoneme[] = []
  for (const word of evidence.words) {
    if (!word || !Array.isArray(word.phonemes)) {
      throw new Error('Pronunciation evidence invalid: each word needs a phonemes array')
    }
    for (const phoneme of word.phonemes) {
      if (!phoneme || typeof phoneme.expected !== 'string' || !phoneme.expected.trim()) {
        throw new Error('Pronunciation evidence invalid: each phoneme needs a non-empty expected symbol')
      }
      if (phoneme.actual !== null && phoneme.actual !== undefined && typeof phoneme.actual !== 'string') {
        throw new Error('Pronunciation evidence invalid: phoneme actual must be a string or null')
      }
      if (
        phoneme.confidence !== null
        && phoneme.confidence !== undefined
        && (typeof phoneme.confidence !== 'number' || !Number.isFinite(phoneme.confidence) || phoneme.confidence < 0 || phoneme.confidence > 1)
      ) {
        throw new Error('Pronunciation evidence invalid: phoneme confidence must be null or a number in 0..1')
      }
      phonemes.push({
        expected: phoneme.expected,
        actual: phoneme.actual === undefined ? null : phoneme.actual,
        confidence: phoneme.confidence === undefined ? null : phoneme.confidence,
      })
    }
  }

  const gated = phonemes.filter((p) => p.confidence === null || p.confidence >= PER_MIN_MEAN_CONFIDENCE)
  const belowConfidenceCount = phonemes.length - gated.length

  const confidenceValues = phonemes.map((p) => p.confidence).filter((c): c is number => c !== null)
  const meanConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
      : null

  if (meanConfidence !== null && meanConfidence < PER_MIN_MEAN_CONFIDENCE) {
    return insufficientPronunciationResult(0, meanConfidence, belowConfidenceCount)
  }

  const targetPhonemes = gated.length
  if (targetPhonemes < PER_MIN_PHONEMES) {
    return insufficientPronunciationResult(targetPhonemes, meanConfidence, belowConfidenceCount)
  }
  const applyDiscount = targetPhonemes >= PER_MIN_PHONEMES_FOR_ACCENT_DISCOUNT

  let weightedErrors = 0
  let substitutions = 0
  let deletions = 0
  let acceptedAccentVariants = 0
  let mildPenaltyVariants = 0
  let fullErrors = 0

  for (const phoneme of gated) {
    if (phoneme.actual === null) {
      deletions += 1
      fullErrors += 1
      weightedErrors += 1
      continue
    }
    if (normalizeIpa(phoneme.expected) === normalizeIpa(phoneme.actual)) continue // correct production
    const classification = classifyPhonemePair(phoneme.expected, phoneme.actual)
    if (classification === 'ACCEPTED_ACCENT_VARIATION') {
      acceptedAccentVariants += 1
      continue
    }
    if (classification === 'MILD_PENALTY') {
      mildPenaltyVariants += 1
      substitutions += 1
      weightedErrors += PER_MILD_SUBSTITUTION_WEIGHT
      continue
    }
    substitutions += 1
    fullErrors += 1
    weightedErrors += 1
  }

  const plainPer = (substitutions + deletions) / targetPhonemes
  const calibratedPer = clamp01(weightedErrors / targetPhonemes)

  const status: MetricStatus = applyDiscount ? 'complete' : 'partial'
  const score = clamp01(1 - calibratedPer) * 100

  return {
    status,
    score,
    rawMetrics: {
      targetPhonemes,
      substitutions,
      deletions,
      insertions: 0,
      acceptedAccentVariants,
      mildPenaltyVariants,
      fullErrors,
      rawPer: plainPer,
      calibratedPer,
      meanConfidence,
      belowConfidenceCount,
    },
  }
}

function insufficientPronunciationResult(
  targetPhonemes: number,
  meanConfidence: number | null,
  belowConfidenceCount: number,
): PronunciationScoreResult {
  return {
    status: 'insufficient_evidence',
    score: null,
    rawMetrics: {
      targetPhonemes,
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      acceptedAccentVariants: 0,
      mildPenaltyVariants: 0,
      fullErrors: 0,
      rawPer: null,
      calibratedPer: null,
      meanConfidence,
      belowConfidenceCount,
    },
  }
}

// ===========================================================================
// DECISION 3 — WPM range  (SCORING-004 certification)
// ===========================================================================
// SCORING_MD_RULE (spec §5.2): the explicit normalization formula uses 40..120;
// the 70–110 learner band is a pedagogical target, not the normalization. Per
// the documented conflict rule ("Do not silently reconcile") the normalization
// stays 40..120 and 70–110 is documented as the target band only.
// INTERNATIONAL_RESEARCH supports this: learner speech rates average far below
// native rates (ESL mean ≈ 84 WPM, Dogar 2025; B2 ≈ 118 WPM, C1 ≈ 142 WPM vs
// native ≈ 174 WPM, Birmingham 2017), so the 40 floor keeps slow-but-valid
// learner speech scoreable while 120 bounds near-native rates.

/** Pedagogical target band for Indonesian junior/senior-high learners (documentation only). */
export const FLUENCY_WPM_LEARNER_TARGET = { min: 70, max: 110 } as const
/** Minimum speech duration for any rate-based metric to be meaningful (matches spec §9 gate). */
export const FLUENCY_MIN_SPEECH_DURATION_MS = 1_500

// ===========================================================================
// DECISION 5 — Grammar length policy  (SCORING-006 certification)
// ===========================================================================
// SCORING_MD_RULE (spec §7.1): Sg = max(0, 100 − Σ(count × penalty)) stays the
// canonical formula — no silent length normalization (also required by spec
// §7.3: do not introduce length normalization without explicit approval; this
// decision IS that approval to keep the flat rule).
// INTERNATIONAL_RESEARCH: accuracy and complexity are distinct constructs
// (Foster & Wigglesworth 2016; Hunt 1965 T-unit; Bardovi-Harlig 1992);
// normalizing by length rewards verbosity, which the gate forbids.
// ENGINEERING_DECISION: token/clause counts stay persisted in raw metrics and a
// thin sample downgrades evidence STATUS without penalizing the score.

/** Below this many tokens grammar evidence is a thin sample (status downgrade, no penalty). */
export const GRAMMAR_MIN_TOKENS_FOR_COMPLETE_STATUS = 8

/** DECISION 5: thin grammar samples stay scored but flagged partial (never penalized for length). */
export function resolveGrammarMetricStatus(tokenCount: number): MetricStatus {
  if (!Number.isFinite(tokenCount) || tokenCount < 0) {
    throw new Error('Grammar evidence invalid: token count must be a non-negative finite number')
  }
  return tokenCount >= GRAMMAR_MIN_TOKENS_FOR_COMPLETE_STATUS ? 'complete' : 'partial'
}

// ===========================================================================
// DECISION 6 — TTR normalization: MATTR  (SCORING-007)
// ===========================================================================
// INTERNATIONAL_RESEARCH: raw TTR is strongly length-dependent (longer samples
// mechanically lower it). Covington & McFall 2010 propose MATTR — moving-average
// TTR over a fixed ~50-token window — which is robust to sample length.
// Implemented exactly: window 50; raw TTR fallback for samples ≤ 50 tokens.

/** MATTR moving-window size (Covington & McFall 2010). */
export const MATTR_WINDOW = 50
/** Below this token count even a raw TTR is statistically thin → insufficient. */
export const VOCAB_MIN_TOKENS = 30
/** TTRnorm maps MATTR/TTR ≥ 0.5 to full diversity (ENGINEERING_DECISION normalization). */
export const TTR_NORM_FULL_SCALE = 0.5

/** Moving-average TTR over fixed windows; equals raw TTR when tokens fit one window. */
export function computeMattr(tokens: readonly string[], window: number): number {
  if (tokens.length === 0 || window <= 0) return 0
  if (tokens.length <= window) {
    return new Set(tokens).size / tokens.length
  }
  let total = 0
  let windows = 0
  for (let start = 0; start + window <= tokens.length; start += 1) {
    const slice = tokens.slice(start, start + window)
    total += new Set(slice).size / window
    windows += 1
  }
  return windows > 0 ? total / windows : 0
}

// ===========================================================================
// DECISION 7 — CEFR vocabulary lookup  (SCORING-007)
// ===========================================================================
// The New General Service List (Browne, Culligan & Phillips 2013,
// newgeneralservicelist.com, CC BY-SA) is the authoritative high-frequency
// reference. Its full 2,801-word list is NOT redistributed here; the engine
// embeds a curated high-frequency headword core plus a closed function-word
// set. Tokens NOT found are classified UNKNOWN and scored neutrally — an
// explicit fallback policy (spec §8.2), never a fabricated CEFR label.
// The Oxford 3000/5000 by CEFR was evaluated and rejected: redistribution
// licensing is restricted (ENGINEERING_DECISION).

const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'a','an','the','and','or','but','if','of','to','in','on','at','by','for','with','about','from','as','into','like',
  'through','after','over','between','out','against','during','without','before','under','around','among','up','down',
  'off','near','i','me','my','mine','myself','we','us','our','ours','ourselves','you','your','yours','yourself',
  'yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their',
  'theirs','themselves','this','that','these','those','am','is','are','was','were','be','been','being','have','has',
  'had','having','do','does','did','doing','will','would','shall','should','can','could','may','might','must','not',
  'no','yes','so','too','very','just','also','then','than','there','here','when','where','why','how','what','which',
  'who','whom','whose','because','while','until','since','although','though','however','therefore','again','once',
  'all','any','both','each','few','more','most','other','some','such','only','own','same','now','ever','never',
  'always','often','sometimes','usually','maybe','please','ok','okay','oh','um','uh','well','yeah','one','two',
  'three','four','five','six','seven','eight','nine','ten','eleven','twelve','hundred','thousand',
])

/** Curated NGSL-core headwords (high-frequency backbone; see DECISION 7 provenance). */
const NGSL_CORE_HEADWORDS: ReadonlySet<string> = new Set([
  // People & relationships
  'person','people','man','woman','child','boy','girl','baby','friend','family','mother','father','brother','sister',
  'son','daughter','parent','wife','husband','teacher','student','doctor','nurse','farmer','driver','worker','boss',
  'neighbor','neighbour','guest','member','leader','player','partner','customer','patient','police','soldier',
  'singer','actor','artist','writer','chef','waiter','engineer','lawyer','coach','group','team','class','crowd',
  // Body & health
  'head','eye','ear','nose','mouth','tooth','teeth','hair','face','hand','arm','leg','foot','heart','skin','blood',
  'health','sick','ill','tired','hungry','thirsty','strong','weak','medicine','hospital','pain','body','finger','knee',
  // Home & objects
  'house','home','room','door','window','wall','floor','roof','kitchen','bed','chair','table','desk','box','bag',
  'bottle','cup','glass','plate','spoon','fork','knife','key','clock','phone','television','radio','camera','computer',
  'book','pen','pencil','paper','letter','card','picture','photo','light','lamp','clothes','shirt','pants','dress',
  'shoe','hat','jacket','uniform','money','coin','shop','store','market','mall','gift','toy','garden','yard','street',
  // Food
  'food','rice','bread','egg','milk','tea','coffee','water','juice','soup','sugar','salt','meat','chicken','fish',
  'fruit','apple','banana','vegetable','breakfast','lunch','dinner','meal','snack','cook','bake','taste','delicious',
  // Places & travel
  'place','city','town','village','country','world','school','classroom','library','office','factory','bank','hotel',
  'restaurant','station','airport','park','beach','mountain','river','lake','sea','forest','bridge','road','building',
  'bus','train','car','motorcycle','bicycle','boat','ship','plane','ticket','trip','journey','travel','visit','map',
  // Nature & weather
  'sun','moon','star','sky','cloud','rain','wind','storm','weather','fire','smoke','tree','flower','plant','animal',
  'dog','cat','bird','horse','cow','sheep','nature','air','land','ground','grass','leaf','stone','snow','ice','heat',
  // Time
  'time','year','month','week','day','night','morning','afternoon','evening','hour','minute','second','today',
  'tomorrow','yesterday','weekend','birthday','holiday','vacation','party','wedding','moment','age','century','date',
  // Activities & verbs
  'work','job','study','learn','teach','read','write','listen','speak','talk','say','tell','ask','answer','think',
  'know','understand','remember','forget','see','look','watch','hear','feel','touch','hold','keep','put','take','give',
  'bring','carry','make','build','fix','clean','wash','open','close','start','stop','begin','end','finish','continue',
  'help','support','share','send','receive','buy','sell','pay','spend','save','cost','win','lose','play','game','sport',
  'football','basketball','badminton','swim','run','walk','jump','dance','sing','draw','paint','ride','drive','fly',
  'sleep','rest','relax','wait','meet','join','leave','arrive','return','stay','live','move','change','grow',
  'try','use','need','want','love','like','hate','hope','wish','dream','believe','decide','choose','plan','prepare',
  'practice','practise','exercise','train','compete','explain','describe','discuss','agree','argue','smile','laugh',
  'cry','shout','call','invite','welcome','thank','apologize','apologise','suggest','promise','allow','offer','refuse',
  // Qualities & abstract
  'good','bad','big','small','large','little','long','short','tall','new','old','young','early','late','fast','slow',
  'hot','cold','warm','cool','wet','dry','dirty','easy','hard','difficult','simple','important',
  'special','common','different','similar','correct','true','real','right','full','empty',
  'heavy','loud','quiet','soft','dark','bright','beautiful','pretty','ugly','happy','sad','angry',
  'afraid','scared','surprised','excited','bored','busy','free','safe','dangerous','rich','poor','cheap','expensive',
  'kind','friendly','polite','honest','brave','smart','clever','funny','serious','interesting','boring','fun','lucky',
  'famous','popular','ready','sure','possible','impossible','able','better','best','worse','worst','idea','thought',
  'word','sentence','story','question','name','number','way','thing','part','reason','result','fact',
  'problem','example','chance','choice','decision','goal','life','business',
  'information','news','message','email','history','culture','language','english','lesson','subject','test',
  'exam','homework','grade','score','level','skill','talent','interest','hobby','music','song','movie','film','show',
  'art','color','sound','voice','noise','smell','feeling','joy','fear',
  'truth','lie','secret','mistake','accident','danger','safety','law','rule','order','peace','war','power',
  'control','government','president','election','society','community','nation','population','economy',
])

/** True if the token is a known high-frequency word via direct, lemmatized, or e-restored lookup. */
function isHighFrequencyToken(lowerToken: string, lemmatized: string): boolean {
  return FUNCTION_WORDS.has(lowerToken) || NGSL_CORE_HEADWORDS.has(lowerToken)
    || NGSL_CORE_HEADWORDS.has(lemmatized) || NGSL_CORE_HEADWORDS.has(`${lemmatized}e`)
}

/**
 * Deterministic light lemmatization (documented approximation, ordered rules):
 * plurals (-ies→y, -sses→ss, -ches/-shes/-xes/-zes, -es, -s) and regular
 * past/progressive (-ied→y, -ed, -ing with doubled-consonant repair). Unknown
 * lemmas simply miss the lookup and fall into the neutral UNKNOWN class.
 */
export function lemmatize(token: string): string {
  const word = token
  if (word.length >= 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length >= 6 && word.endsWith('sses')) return word.slice(0, -2)
  if (word.length >= 5 && (word.endsWith('ches') || word.endsWith('shes') || word.endsWith('xes') || word.endsWith('zes'))) return word.slice(0, -2)
  if (word.length >= 5 && word.endsWith('ied')) return `${word.slice(0, -3)}y`
  if (word.length >= 5 && word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2)
  if (word.length >= 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  if (word.length >= 5 && word.endsWith('ed')) {
    const stem = word.slice(0, -2)
    if (stem.length >= 3 && stem.at(-1) === stem.at(-2) && !'aeiou'.includes(stem.at(-1) ?? '')) return stem.slice(0, -1)
    return stem
  }
  if (word.length >= 6 && word.endsWith('ing')) {
    const stem = word.slice(0, -3)
    if (stem.length >= 3 && stem.at(-1) === stem.at(-2) && !'aeiou'.includes(stem.at(-1) ?? '')) return stem.slice(0, -1)
    return stem
  }
  return word
}

function cleanToken(token: string): string {
  return token.replace(/^[-'’]+|[-'’]+$/g, '')
}

/** Case-preserving tokenizer; letters-initial words with internal apostrophes/hyphens. */
export function tokenizeWordsPreservingCase(text: string): string[] {
  const matches = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []
  return matches.map(cleanToken).filter((token) => token.length > 0)
}

/** Lowercased tokenizer; numbers are excluded (documented tokenization policy). */
export function tokenizeTranscript(transcript: string): string[] {
  return tokenizeWordsPreservingCase(transcript.toLowerCase())
}

export interface VocabTokenClassCounts {
  highFrequency: number
  /** Distinct lemmas beyond the curated core (neutral class, kept for banding). */
  beyondCoreDistinct: number
  unknown: number
  properNoun: number
}

export interface VocabularyScoreResult {
  status: MetricStatus
  score: number | null
  rawMetrics: {
    totalTokens: number
    uniqueTokens: number
    rawTtr: number | null
    mattr: number | null
    /** Normalized diversity input: MATTR when > 50 tokens, raw TTR otherwise. */
    ttrNormInput: number | null
    cefrVocabScore: number | null
    tokenClasses: VocabTokenClassCounts
    estimatedCefrBand: EstimatedCefrBand | null
    cefrBandingLabel: typeof CEFR_ESTIMATE_LABEL | null
  }
}

/**
 * DECISION 6 + 7 + 8 — canonical vocabulary score:
 *
 *   TTRnorm          = clamp(MATTR_or_rawTTR / 0.5, 0, 1)
 *   CEFR_Vocab_Score = 100 * highFrequencyTokens / assessedTokens
 *                      (proper nouns excluded from both sides — neutral)
 *   Sv               = [0.5 * TTRnorm + 0.5 * CEFR_Vocab_Score/100] * 100
 *
 * Unknown words are neutral: they are excluded from the coverage numerator but
 * never treated as errors, and they still feed MATTR diversity and the banding
 * estimate via distinct beyond-core lemmas.
 * Status: < 30 tokens insufficient; 30–50 tokens or raw-TTR fallback partial;
 * > 50 tokens with MATTR complete. Malformed input throws (spec §10).
 */
export function scoreVocabularyFromTranscript(transcript: string): VocabularyScoreResult {
  if (typeof transcript !== 'string') throw new Error('Vocabulary evidence invalid: transcript must be a string')
  const tokens = tokenizeTranscript(transcript)
  const totalTokens = tokens.length
  const uniqueTokens = new Set(tokens).size

  if (totalTokens < VOCAB_MIN_TOKENS) {
    return {
      status: 'insufficient_evidence',
      score: null,
      rawMetrics: {
        totalTokens,
        uniqueTokens,
        rawTtr: null,
        mattr: null,
        ttrNormInput: null,
        cefrVocabScore: null,
        tokenClasses: { highFrequency: 0, beyondCoreDistinct: 0, unknown: 0, properNoun: 0 },
        estimatedCefrBand: null,
        cefrBandingLabel: null,
      },
    }
  }

  // Proper-noun heuristic (deterministic approximation, no NER): a capitalized
  // token that is not sentence-initial is treated as a proper noun and scored
  // neutrally. Sentence starts come from splitting on .!? boundaries.
  const lowerTokens = tokens
  const originalTokens = tokenizeWordsPreservingCase(transcript)
  const sentenceStartTokens = new Set<string>()
  for (const segment of transcript.split(/[.!?]+/)) {
    const segmentTokens = tokenizeTranscript(segment)
    if (segmentTokens.length > 0) sentenceStartTokens.add(segmentTokens[0])
  }

  const tokenClasses: VocabTokenClassCounts = { highFrequency: 0, beyondCoreDistinct: 0, unknown: 0, properNoun: 0 }
  const beyondCoreLemmas = new Set<string>()

  for (let index = 0; index < lowerTokens.length; index += 1) {
    const token = lowerTokens[index]
    const lemmatized = lemmatize(token)
    if (isHighFrequencyToken(token, lemmatized)) {
      tokenClasses.highFrequency += 1
      continue
    }
    const original = originalTokens[index] ?? token
    const isCapitalized = original.length > 0 && original[0] !== original[0].toLowerCase()
    if (isCapitalized && !sentenceStartTokens.has(token) && token !== 'i') {
      tokenClasses.properNoun += 1
      continue
    }
    tokenClasses.unknown += 1
    beyondCoreLemmas.add(lemmatized)
  }
  tokenClasses.beyondCoreDistinct = beyondCoreLemmas.size

  const assessedTokens = totalTokens - tokenClasses.properNoun
  const cefrVocabScore = assessedTokens > 0 ? (tokenClasses.highFrequency / assessedTokens) * 100 : 0

  const mattr = computeMattr(tokens, MATTR_WINDOW)
  const rawTtr = uniqueTokens / totalTokens
  const useMattr = totalTokens > MATTR_WINDOW
  const ttrNormInput = useMattr ? mattr : rawTtr
  const status: MetricStatus = useMattr ? 'complete' : 'partial'
  const ttrNorm = clamp01(ttrNormInput / TTR_NORM_FULL_SCALE)
  const score = clamp01(0.5 * ttrNorm + 0.5 * clamp01(cefrVocabScore / 100)) * 100

  return {
    status,
    score,
    rawMetrics: {
      totalTokens,
      uniqueTokens,
      rawTtr,
      mattr,
      ttrNormInput,
      cefrVocabScore,
      tokenClasses,
      estimatedCefrBand: estimateCefrVocabBand(tokenClasses.beyondCoreDistinct, totalTokens),
      cefrBandingLabel: CEFR_ESTIMATE_LABEL,
    },
  }
}

// ===========================================================================
// DECISION 8 — CEFR estimate thresholds & labeling  (SCORING-010)
// ===========================================================================
// SCORING_MD_RULE (spec §2.2, §12): the source defines NO numeric thresholds;
// outputs must be distinguished from official CEFR certification. Progression
// anchors that DO exist: eligibility ≥ 80 for 3 sessions, intervention < 55.
// ENGINEERING_DECISION: estimated B1 vocabulary band at overall ≥ 70 (just
// below the 80 eligibility anchor), B2 at ≥ 85 (above sustained eligibility),
// A1–A2 otherwise. These are ESTIMATES carrying the mandatory disclaimer label.

export type EstimatedCefrBand = 'A1-A2' | 'B1' | 'B2'

export const CEFR_ESTIMATE_THRESHOLDS: Readonly<{ B1: number; B2: number }> = { B1: 70, B2: 85 }
export const CEFR_ESTIMATE_LABEL = 'ENGINEERING_DECISION — estimated band, not an official CEFR certification'

/** DECISION 8: map an overall score to an estimated CEFR band (labeled, not certified). */
export function estimateCefrBand(overallScore: number): EstimatedCefrBand {
  if (!Number.isFinite(overallScore)) throw new Error('CEFR estimate invalid: overall score must be a finite number')
  if (overallScore >= CEFR_ESTIMATE_THRESHOLDS.B2) return 'B2'
  if (overallScore >= CEFR_ESTIMATE_THRESHOLDS.B1) return 'B1'
  return 'A1-A2'
}

/** Vocabulary-specific banding from distinct beyond-core lemmas; null when too thin to estimate. */
function estimateCefrVocabBand(beyondCoreDistinct: number, totalTokens: number): EstimatedCefrBand | null {
  if (totalTokens < VOCAB_MIN_TOKENS) return null
  if (beyondCoreDistinct >= 4) return 'B2'
  if (beyondCoreDistinct >= 1) return 'B1'
  return 'A1-A2'
}

// ===========================================================================
// DECISION 4 — Intonation formula  (SCORING-005)
// ===========================================================================
// SCORING_MD_RULE (spec §6.1): use F0/pitch contour + stress, reward useful
// pitch variation, tolerate flatter regional intonation where intelligibility
// holds. The source defines NO deterministic transformation (§6.2).
// ENGINEERING_DECISION (architecture-driven): the current pipeline produces no
// absolute-F0-reliable acoustic channel, so the canonical formula uses only
// NORMALIZED pitch measures — semitone-scaled variation (p90−p10) and median
// absolute inter-point slope — never absolute Hz thresholds. Optional pitch
// evidence mirrors the fluency pattern: missing → insufficient, never invented.

/** Pitch evidence: optional voiced duration and F0 contour points (unvoiced frames omitted). */
export interface IntonationPitchEvidence {
  /** Voiced (non-silent) duration in ms; when below the minimum, no score. */
  voicedDurationMs?: number | null
  /** F0 contour samples (Hz) with timestamps. */
  pitchPoints: ReadonlyArray<{ timeMs: number; f0Hz: number }>
}

export interface IntonationScoreResult {
  status: MetricStatus
  score: number | null
  rawMetrics: {
    voicedDurationMs: number | null
    pitchPointCount: number
    /** p90−p10 of semitone-scaled F0 (st). */
    pitchVariationSemitones: number | null
    /** Median absolute first-difference of semitone-scaled F0 (st). */
    slopeVariationSemitones: number | null
  }
}

export const INTONATION_MIN_VOICED_MS = 1_000
export const INTONATION_MIN_PITCH_POINTS = 5
/** Physiological F0 validity window (Hz); samples outside are excluded as noise. */
export const INTONATION_F0_MIN_HZ = 50
export const INTONATION_F0_MAX_HZ = 500
/** Normalization band for pitch variation in semitones (≈ 1 st flat → 0, ≥ 10 st expressive → 1). */
export const INTONATION_VARIATION_MIN_ST = 1
export const INTONATION_VARIATION_MAX_ST = 10
/** Normalization band for median |ΔF0| slope in semitones (0 st static → 0, ≥ 1.5 st dynamic → 1). */
export const INTONATION_SLOPE_MIN_ST = 0
export const INTONATION_SLOPE_MAX_ST = 1.5
export const INTONATION_VARIATION_WEIGHT = 0.6
export const INTONATION_SLOPE_WEIGHT = 0.4

function hzToSemitones(f0Hz: number): number {
  return 12 * Math.log2(f0Hz / 55)
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return Number.NaN
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

/**
 * DECISION 4 — canonical intonation score:
 *
 *   st_i      = 12 * log2(F0_i / 55)                     (semitone scaling, 55 Hz reference)
 *   variation = p90(st) − p10(st)
 *   slope     = median(|st_i − st_{i−1}|)                (consecutive voiced samples)
 *   Si        = [0.6 * clamp((variation − 1) / 9, 0, 1)
 *                + 0.4 * clamp(slope / 1.5, 0, 1)] * 100
 *
 * Insufficient evidence (no score, never fabricated): fewer than
 * INTONATION_MIN_PITCH_POINTS valid samples, or voicedDurationMs below
 * INTONATION_MIN_VOICED_MS when reported. Malformed input throws (spec §10).
 */
export function scoreIntonationFromPitch(evidence: IntonationPitchEvidence): IntonationScoreResult {
  if (!evidence || !Array.isArray(evidence.pitchPoints)) {
    throw new Error('Intonation evidence invalid: pitchPoints must be an array')
  }
  const voicedDurationMs =
    evidence.voicedDurationMs === null || evidence.voicedDurationMs === undefined ? null : evidence.voicedDurationMs
  if (voicedDurationMs !== null) {
    if (!Number.isFinite(voicedDurationMs) || voicedDurationMs < 0) {
      throw new Error('Intonation evidence invalid: voicedDurationMs must be a non-negative finite number or null')
    }
  }

  const validPoints = evidence.pitchPoints
    .filter((point) => Boolean(point) && Number.isFinite(point?.f0Hz) && Number.isFinite(point?.timeMs))
    .filter((point) => point.f0Hz >= INTONATION_F0_MIN_HZ && point.f0Hz <= INTONATION_F0_MAX_HZ)
    .slice()
    .sort((a, b) => a.timeMs - b.timeMs)

  const semitones = validPoints.map((point) => hzToSemitones(point.f0Hz))
  const sortedSemitones = semitones.slice().sort((a, b) => a - b)
  const pitchVariationSemitones =
    sortedSemitones.length >= 2 ? Math.max(0, percentile(sortedSemitones, 0.9) - percentile(sortedSemitones, 0.1)) : null

  const slopeValues: number[] = []
  for (let index = 1; index < semitones.length; index += 1) {
    slopeValues.push(Math.abs(semitones[index] - semitones[index - 1]))
  }
  const sortedSlopes = slopeValues.slice().sort((a, b) => a - b)
  const slopeVariationSemitones = sortedSlopes.length > 0 ? percentile(sortedSlopes, 0.5) : null

  const tooShort = voicedDurationMs !== null && voicedDurationMs < INTONATION_MIN_VOICED_MS
  if (validPoints.length < INTONATION_MIN_PITCH_POINTS || tooShort) {
    return {
      status: 'insufficient_evidence',
      score: null,
      rawMetrics: {
        voicedDurationMs,
        pitchPointCount: validPoints.length,
        pitchVariationSemitones,
        slopeVariationSemitones,
      },
    }
  }

  const variationNorm = normalize01(
    pitchVariationSemitones ?? 0,
    INTONATION_VARIATION_MIN_ST,
    INTONATION_VARIATION_MAX_ST,
  )
  const slopeNorm = normalize01(slopeVariationSemitones ?? 0, INTONATION_SLOPE_MIN_ST, INTONATION_SLOPE_MAX_ST)
  const score = clamp01(INTONATION_VARIATION_WEIGHT * variationNorm + INTONATION_SLOPE_WEIGHT * slopeNorm) * 100

  return {
    status: 'complete',
    score,
    rawMetrics: {
      voicedDurationMs,
      pitchPointCount: validPoints.length,
      pitchVariationSemitones,
      slopeVariationSemitones,
    },
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function normalize01(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

// ===========================================================================
// Decision ledger — machine-readable summary for docs/tests (spec §21)
// ===========================================================================

export interface ScoringDecisionRecord {
  id: string
  decision: string
  provenance: EvidenceProvenance
  primarySources: readonly string[]
}

export const SCORING_DECISION_LEDGER: readonly ScoringDecisionRecord[] = [
  {
    id: 'D1_PER_CALIBRATION',
    decision: 'PER=(S+D+I)/N on gated alignment; rawPer=(S+D)/N; E_w=Σw (accent 0/0.85/1); PER_cal=clamp(E_w/N); Sp=100*(1-PER_cal); gates: ≥8 phonemes (partial <20), mean confidence ≥0.6',
    provenance: 'SCORING_MD_RULE',
    primarySources: ['SCORING_SPEC.md §4.1–4.2', 'El Kheir et al. 2023 (arXiv:2310.13974)', 'Kadambi 2024'],
  },
  {
    id: 'D2_ACCENT_SUBSTITUTION_TABLE',
    decision: 'Context-keyed IPA substitution table with 3 classes (accepted 0 / mild 0.85 / full 1); cluster simplification = full error; accent ≠ automatic error',
    provenance: 'SCORING_MD_RULE',
    primarySources: [
      'SCORING_SPEC.md §4.2',
      'Language Literacy (UISU) 2021',
      'Syam 2024 (MDPI Languages 9(6):222)',
      'Deterding & Kirkpatrick 2006',
      'IJSSH 409-CH346',
      'Derwing & Munro 1997',
    ],
  },
  {
    id: 'D3_WPM_RANGE',
    decision: 'Keep explicit normalization 40..120 WPM (MD rule over target band); 70–110 documented as pedagogical target only; minimum speech duration 1.5 s',
    provenance: 'SCORING_MD_RULE',
    primarySources: ['SCORING_SPEC.md §5.1–5.2', 'Birmingham 2017 speech-rate corpus', 'Dogar 2025 (ESL ≈ 84 WPM)'],
  },
  {
    id: 'D4_INTONATION_FORMULA',
    decision: 'Si = [0.6*clamp((st_p90−st_p10−1)/9,0,1) + 0.4*clamp(median|Δst|/1.5,0,1)]*100 on optional pitch evidence; insufficient below 5 points or 1 s voiced; no absolute Hz thresholds',
    provenance: 'ENGINEERING_DECISION',
    primarySources: ['SCORING_SPEC.md §6.1–6.2', 'Derwing & Munro 1997 (flat regional intonation tolerance)'],
  },
  {
    id: 'D5_GRAMMAR_LENGTH_POLICY',
    decision: 'Keep flat penalty Sg=max(0,100−Σ); no length normalization (never reward verbosity); record token/clause counts; findings below 8 tokens → partial status, not penalized',
    provenance: 'SCORING_MD_RULE',
    primarySources: ['SCORING_SPEC.md §7.1–7.3', 'Foster & Wigglesworth 2016', 'Hunt 1965', 'Bardovi-Harlig 1992'],
  },
  {
    id: 'D6_TTR_NORMALIZATION',
    decision: 'MATTR window 50 (moving-average TTR); raw TTR fallback ≤ 50 tokens; ≥ 30 tokens required, 30–50 partial; TTRnorm = clamp(MATTR/0.5, 0, 1); numbers excluded from tokens',
    provenance: 'INTERNATIONAL_RESEARCH',
    primarySources: ['Covington & McFall 2010 (doi:10.1080/09296171003643098)'],
  },
  {
    id: 'D7_CEFR_VOCAB_LOOKUP',
    decision: 'High-frequency lookup over embedded NGSL-core + function words with light deterministic lemmatization; unknown words neutral (excluded from coverage numerator, never errors); proper nouns neutral-excluded; Oxford 3000/5000 rejected on licensing',
    provenance: 'ENGINEERING_DECISION',
    primarySources: ['Browne, Culligan & Phillips 2013 (newgeneralservicelist.com, CC BY-SA)', 'oxfordlearnersdictionaries.com (licensing note)'],
  },
  {
    id: 'D8_CEFR_THRESHOLD',
    decision: 'Estimated bands only, labeled ENGINEERING_DECISION: A1–A2 < 70, B1 ≥ 70, B2 ≥ 85 overall; anchored to MD progression rules (80 eligibility / 55 intervention); never presented as certification',
    provenance: 'ENGINEERING_DECISION',
    primarySources: ['SCORING_SPEC.md §2.2, §12', 'Council of Europe CEFR 2001 (qualitative anchor)'],
  },
  {
    id: 'D9_MISSING_METRIC_POLICY',
    decision: 'MetricStatus complete/partial/insufficient_evidence/failed; missing engine evidence falls back to the provider estimate only with confidence ≥ 0.6 and stays labeled PROVIDER_ESTIMATE_FALLBACK; never silent zero',
    provenance: 'SCORING_MD_RULE',
    primarySources: ['SCORING_SPEC.md §10, §13'],
  },
]
