# TuturAI — Canonical Scoring System Specification

**Document:** `SCORING_SPEC.md`  
**Purpose:** Canonical backend scoring contract for TuturAI speaking assessment, progression, persistence, and reporting.  
**Source basis:** `Spesifikasi_Sistem_Penilaian_TuturAI.pdf` (TUTURAI-SPECS-2026-V2.4, September 2026).  
**Execution rule:** This document defines scoring behavior. `EXECUTION.md` remains the runtime task/evidence state.

> IMPORTANT
>
> - Do not let the frontend or an LLM invent `final_score`.
> - Do not silently replace source-defined formulas.
> - Any formula/threshold not fully defined by the source must remain `DECISION_REQUIRED` until explicitly resolved.
> - Provider/model names are implementation details unless a product requirement explicitly makes them mandatory.
> - All production scoring must be versioned and reproducible.

---

## 1. Integration Timing

This scoring subsystem is **backend/domain work**, not a post-release cosmetic feature.

Integrate it after the core application foundation is stable enough to support:
- authentication/session/RBAC;
- student identity and classroom membership;
- speaking/assessment session persistence;
- stable API/domain conventions;
- current provider adapter boundary.

Do **not** wait until every backend/release task is finished.

Recommended order:

```text
Core Auth / Classroom / Assignment / Learning Foundation
↓
Speaking / Assessment Provider Boundary Stable
↓
SCORING SYSTEM IMPLEMENTATION
↓
Teacher/Student Analytics + Adaptive Learning Integration
↓
Full Durable E2E
↓
Design Overhaul
↓
Preview / Production E2E
↓
Final Release Gates
```

The scoring phase must be completed before final analytics/reporting, adaptive progression certification, protected production E2E, and final release readiness.

---

# 2. Product Scoring Principles — SOURCE-DEFINED

## 2.1 Intelligibility over Accent Calibration

TuturAI evaluates whether student speech is understandable rather than forcing imitation of a native American/British accent.

Local Indonesian / Southeast Asian accent variation must not automatically produce severe penalties if speech remains intelligible.

## 2.2 CEFR Alignment

Assessment outputs are intended to map to CEFR levels:

- A1 — Beginner
- A2 — Elementary
- B1 — Intermediate
- B2 — Upper Intermediate

**DECISION_REQUIRED:** The source does not define exact numeric thresholds mapping final/progression score to A1/A2/B1/B2. Do not invent them.

---

# 3. Canonical Five-Dimension Scoring

Each completed online speaking assessment produces five scores in the range `0..100`.

| Dimension | Symbol | Weight | Source metric |
|---|---:|---:|---|
| Pronunciation | `Sp` | 25% | Phoneme Error Rate (PER) |
| Fluency | `Sf` | 20% | WPM + pause duration ratio |
| Intonation | `Si` | 15% | F0/pitch contour + stress |
| Grammar | `Sg` | 20% | grammatical error density / weighted error penalties |
| Vocabulary | `Sv` | 20% | TTR + CEFR vocabulary score |

Canonical weighted aggregation:

```text
Sfinal =
  0.25 * Sp +
  0.20 * Sf +
  0.15 * Si +
  0.20 * Sg +
  0.20 * Sv
```

All dimension scores and `Sfinal` must be clamped to `[0, 100]`.

The backend/domain scoring engine is the canonical authority for this aggregation.

---

# 4. Pronunciation

## 4.1 SOURCE-DEFINED Formula

Phoneme Error Rate:

```text
PER = (S + D + I) / N
```

Where:
- `S` = substitutions;
- `D` = deletions;
- `I` = insertions;
- `N` = total target phonemes.

Source score:

```text
Sp = 100 * (1 - PER_calibrated)
```

## 4.2 Accent Calibration

The source states that intelligible Indonesian-accent substitutions should receive a lighter penalty, approximately `10–15%`, rather than automatically producing a zero score.

## 4.3 DECISION_REQUIRED

Before production implementation is certified, define explicitly:

- how `PER_calibrated` is derived from raw PER;
- which phoneme substitutions receive reduced penalties;
- whether penalty values are fixed or configurable;
- how provider confidence affects scoring;
- behavior when target phoneme alignment is unavailable;
- minimum phoneme count required for a valid score.

Until defined, provider output may be persisted as raw pronunciation evidence but must not be represented as a fully validated canonical production pronunciation score.

---

# 5. Fluency

## 5.1 SOURCE-DEFINED Formula

Source target for Southeast Asian EFL learners:

```text
70–110 WPM
```

Source scoring:

```text
Sf = [0.6 * WPMnorm + 0.4 * (1 - Rpause)] * 100
```

Source boundary definitions:

```text
WPMnorm = clamp((WPM - 40) / (120 - 40), 0.0, 1.0)

Rpause = clamp(
  total_pause_duration / total_recording_duration,
  0.0,
  1.0
)
```

## 5.2 SPECIFICATION CONFLICT

The source states a preferred learner range of `70–110 WPM` while its explicit normalization formula uses `40..120`.

Do not silently reconcile this.

Mark implementation configuration as:

```text
FLUENCY_WPM_NORMALIZATION = DECISION_REQUIRED
```

until the project owner selects the authoritative normalization rule.

---

# 6. Intonation

## 6.1 SOURCE-DEFINED Behavior

Use:
- fundamental frequency (`F0`);
- pitch contour;
- stress behavior;
- positive recognition of useful pitch variation;
- tolerance for flatter regional-language influenced intonation where intelligibility remains acceptable.

## 6.2 DECISION_REQUIRED

The source does **not** define an exact deterministic transformation from F0/stress measurements to `Si ∈ [0,100]`.

Before production certification define:
- input acoustic features;
- reference baseline;
- normalization;
- weighting;
- minimum voiced duration;
- missing/unreliable pitch handling;
- exact score formula.

Do not invent a production `Si` formula inside an API handler or LLM prompt.

---

# 7. Grammar

## 7.1 SOURCE-DEFINED Formula

```text
Sg = max(
  0,
  100 - Σ(error_count * penalty_weight)
)
```

Source penalties:

| Error class | Example | Penalty |
|---|---|---:|
| Light | article `a/an` | -5 |
| Medium | subject-verb agreement | -10 |
| Heavy | contextually incorrect tense | -15 |

## 7.2 Engineering Requirement

Provider/LLM output must be structured.

Minimum finding contract:

```ts
type GrammarFinding = {
  category: string
  severity: "light" | "medium" | "heavy"
  original?: string
  corrected?: string
  explanation?: string
  confidence?: number
}
```

The scoring engine — not the LLM — applies the canonical penalty table.

## 7.3 DECISION_REQUIRED

The source does not specify normalization for response length.

Do not silently introduce length normalization without explicit approval.

If raw weighted penalties are used initially, preserve:
- token count;
- sentence/clause count;
- error counts by category;

so future formula versions can be recomputed.

---

# 8. Vocabulary

## 8.1 SOURCE-DEFINED Formula

```text
TTR = unique_word_count / total_word_count

Sv =
  [0.5 * TTRnorm + 0.5 * CEFR_Vocab_Score] * 100
```

## 8.2 DECISION_REQUIRED

The source does not define:
- `TTRnorm`;
- exact CEFR vocabulary scoring lookup;
- minimum text length;
- treatment of punctuation/fillers/contractions;
- response-length bias handling.

These must be defined before the vocabulary score is considered production-certified.

Persist raw vocabulary metrics independently from normalized scores.

---

# 9. Audio Quality Gate

Before scoring, validate audio quality.

Source-defined retry conditions:

```text
if SNR < 10 dB:
    RETRY_AUDIO_TOO_NOISY

if speech_duration < 1.5 seconds:
    RETRY_SPEECH_TOO_SHORT
```

If rejected:
- do not fabricate any dimension score;
- do not create fake success;
- do not progress CEFR;
- return a retryable explicit status;
- preserve safe, supportive UI messaging.

Canonical quality result:

```ts
type AudioQualityResult =
  | {
      accepted: true
      snrDb: number
      speechDurationMs: number
    }
  | {
      accepted: false
      reason:
        | "RETRY_AUDIO_TOO_NOISY"
        | "RETRY_SPEECH_TOO_SHORT"
      snrDb?: number
      speechDurationMs?: number
    }
```

---

# 10. Boundary and Clamping Rules

Use safe clamping for normalized values.

Source-defined generic form:

```text
Sx = clamp(
  ((x - xmin) / (xmax - xmin)) * 100,
  0,
  100
)
```

All implementations must explicitly guard:
- division by zero;
- NaN;
- Infinity;
- negative durations/counts;
- invalid provider output;
- missing metrics;
- scores outside `0..100`.

Invalid required inputs must fail explicitly rather than silently defaulting to a plausible score.

---

# 11. Offline / Online Mode

## 11.1 SOURCE-DEFINED Offline Temporary Score

Offline edge scoring uses temporary pronunciation and fluency:

```text
OfflineScore =
  0.70 * Sp_offline +
  0.30 * Sf_offline
```

This is not equivalent to the full online five-dimension score.

## 11.2 Online Reprocessing

When full online evidence is available:
- perform full five-dimension scoring;
- persist the authoritative online result;
- preserve provenance that an earlier edge score existed;
- do not overwrite historical evidence without traceability.

Current TuturAI persistence architecture must be used; references in the source PDF to older database/backend technology are historical implementation details, not a requirement to migrate the current stack.

---

# 12. Adaptive Progression — EWMA

Source-defined progression formula:

```text
progress_new =
  0.3 * Sfinal +
  0.7 * progress_old
```

Source rules:

```text
if progress_new >= 80 for 3 consecutive sessions:
    eligible_for_next_CEFR_module

if progress_new < 55:
    trigger_adaptive_intervention_on_weakest_area
```

Persist separately:

```text
session_score
progress_ewma
cefr_level
```

Never overwrite an individual session score with the EWMA value.

**DECISION_REQUIRED:** Exact CEFR level mapping remains undefined by the source.

---

# 13. Provider Boundary

Provider/model adapters produce evidence.

The canonical scoring engine produces scores.

Preferred flow:

```text
Audio
↓
Quality Gate
↓
Acoustic / STT / NLP Provider Adapters
↓
Raw Structured Evidence
↓
Canonical TuturAI Scoring Engine
↓
Five Dimension Scores
↓
Weighted Final Score
↓
Progression / CEFR
↓
Persistence
↓
Student + Teacher UI
```

Do not bind the scoring contract to a single model name unless the PRD explicitly requires it.

Provider replacement must not require rewriting the canonical scoring formulas.

---

# 14. Canonical Output Contract

Minimum backend/domain result:

```ts
type TuturAIScoringResult = {
  scoringVersion: string
  sessionId: string
  studentId: string
  mode: "OFFLINE_EDGE" | "ONLINE_FULL"

  quality: {
    accepted: boolean
    snrDb?: number
    speechDurationMs?: number
    retryReason?:
      | "RETRY_AUDIO_TOO_NOISY"
      | "RETRY_SPEECH_TOO_SHORT"
  }

  scores?: {
    pronunciation: number
    fluency: number
    intonation: number
    grammar: number
    vocabulary: number
    final: number
  }

  rawMetrics?: {
    wpm?: number
    pauseRatio?: number
    phonemeErrorRate?: number
    typeTokenRatio?: number
    [key: string]: number | string | boolean | null | undefined
  }

  cefr?: {
    detected?: "A1" | "A2" | "B1" | "B2"
    progressEwma?: number
  }

  feedback?: {
    strengths: string[]
    improvements: string[]
    corrections: Array<{
      original?: string
      corrected?: string
      explanation: string
    }>
  }
}
```

API field naming may follow current repository conventions, but semantic meaning must remain stable.

---

# 15. Scoring Versioning

Every persisted canonical assessment must contain:

```text
scoring_version
```

Example:

```text
2026.1
```

A scoring formula change that can alter a student result requires a new scoring version.

Never silently reinterpret historical scores with a new formula.

Where possible persist enough raw evidence to support future offline recomputation/migration.

---

# 16. Persistence Requirements

Persist at minimum:

- assessment/session ID;
- student/user ID;
- classroom ID where applicable;
- timestamps;
- source mode;
- scoring version;
- five dimension scores;
- final score;
- raw metrics;
- quality-gate data;
- provider/model provenance;
- provider confidence/error metadata where available;
- EWMA progression state;
- CEFR state;
- qualitative feedback/corrections;
- retry/failure state when no score is produced.

Do not persist fabricated scores on provider failure.

---

# 17. Recommended Code Boundary

Adapt paths to the existing monorepo architecture rather than forcing this exact directory structure.

Preferred logical separation:

```text
domain/scoring/
  types
  constants
  audio-quality
  pronunciation
  fluency
  intonation
  grammar
  vocabulary
  aggregate
  progression
  cefr
  version
```

API routes/controllers should orchestrate.

They should not contain the canonical mathematical implementation inline.

---

# 18. Deterministic Aggregation Example

Given:

```text
Pronunciation = 80
Fluency       = 70
Intonation    = 90
Grammar       = 85
Vocabulary    = 75
```

Expected:

```text
Sfinal =
  (80 * 0.25) +
  (70 * 0.20) +
  (90 * 0.15) +
  (85 * 0.20) +
  (75 * 0.20)

Sfinal = 79.5
```

This must be a deterministic unit test.

---

# 19. Required Test Layers

## SCORING UNIT

Test:
- weights;
- aggregation;
- clamping;
- zero/invalid denominators;
- audio gates;
- raw metric validation;
- EWMA;
- versioning.

## DIMENSION TESTS

Test each dimension using deterministic fixtures.

If a dimension is `DECISION_REQUIRED`, test only the currently approved behavior and keep production certification open.

## INTEGRATION

Test:

```text
provider evidence
→ scoring engine
→ persistence
→ API read-back
```

## DURABLE E2E

For a full online speaking flow:

```text
student browser action
→ audio submission
→ quality gate
→ provider evidence
→ canonical scoring
→ persisted assessment
→ reload/read-back
→ student score rendering
→ teacher-visible result where applicable
```

No durable completion may rely only on seeded/fabricated final scores.

## NEGATIVE PATHS

At minimum:
- noisy audio;
- too-short speech;
- malformed provider response;
- missing required metric;
- provider unavailable;
- unauthorized student;
- wrong classroom;
- duplicate/idempotent submission where applicable.

---

# 20. Execution Tasks

Recommended task IDs:

```text
SCORING-000  Normalize source specification and unresolved decisions
SCORING-001  Canonical types + scoring version
SCORING-002  Audio quality gate
SCORING-003  Pronunciation evidence + approved formula
SCORING-004  Fluency formula
SCORING-005  Intonation evidence + approved formula
SCORING-006  Grammar structured findings + formula
SCORING-007  Vocabulary evidence + formula
SCORING-008  Weighted aggregation
SCORING-009  EWMA progression
SCORING-010  CEFR mapping
SCORING-011  Persistence integration
SCORING-012  API integration
SCORING-013  Student/teacher UI consumption
SCORING-014  Unit/integration test suite
SCORING-015  Durable speaking scoring E2E
SCORING-016  Analytics/adaptive integration regression
```

---

# 21. Human Decision Gate

Before claiming the scoring system production-ready, obtain explicit decisions for every unresolved source gap:

```text
[ ] PER_calibrated exact rule
[ ] Indonesian accent substitution penalty table/rule
[ ] authoritative WPM normalization range
[ ] deterministic intonation score formula
[ ] grammar length-normalization policy (if any)
[ ] TTR normalization
[ ] CEFR vocabulary scoring
[ ] CEFR final/progression score thresholds
[ ] missing-metric/confidence policy
```

Until resolved, related tasks remain:

```text
AWAITING_SCORING_DECISION
```

Do not invent these values.

---

# 22. Completion Gate

The scoring subsystem is complete only when:

- source-defined formulas are implemented correctly;
- every unresolved formula has explicit owner approval;
- scoring is provider-independent;
- scores are deterministic from structured evidence;
- final score is backend/domain-computed;
- scoring version is persisted;
- quality gates fail safely;
- individual session score and EWMA are separate;
- CEFR behavior uses explicitly approved thresholds;
- durable persistence/read-back is proven;
- student and teacher views consume persisted canonical scores;
- affected analytics/adaptive behavior is verified;
- durable E2E passes;
- no fake/simulated score can reach production as successful assessment.

Final execution flag:

```text
SCORING_PRODUCTION_READY=true
```

Only set this after all mandatory evidence and human decisions above are complete.
