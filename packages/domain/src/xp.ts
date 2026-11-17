/**
 * XP is derived from the canonical attempt score, never invented by the UI.
 *
 * The scoring engine produces a score per completed attempt (SCORING_SPEC §3).
 * TuturAI presents that score on a 1..100 scale, so a completed attempt is never
 * worth nothing. XP is a fixed fraction of the score: a stronger attempt is
 * always worth more, and every completed attempt moves the student forward.
 */

export const ATTEMPT_SCORE_MIN = 1
export const ATTEMPT_SCORE_MAX = 100
export const XP_PER_ATTEMPT_MAX = 20
export const XP_PER_LEVEL = 100

/** Clamps any provider/engine score onto the 1..100 scale the UI promises. */
export function clampAttemptScore(score: number): number {
  if (!Number.isFinite(score)) return ATTEMPT_SCORE_MIN
  return Math.min(ATTEMPT_SCORE_MAX, Math.max(ATTEMPT_SCORE_MIN, Math.round(score)))
}

/** XP a single completed attempt is worth: 1..20, proportional to its score. */
export function xpForAttempt(score: number): number {
  const clamped = clampAttemptScore(score)
  return Math.max(1, Math.round((clamped / ATTEMPT_SCORE_MAX) * XP_PER_ATTEMPT_MAX))
}

export function levelForXp(xp: number): number {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0
  return Math.floor(safe / XP_PER_LEVEL) + 1
}
