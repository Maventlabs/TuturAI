import { describe, expect, it } from 'vitest'
import { ATTEMPT_SCORE_MAX, ATTEMPT_SCORE_MIN, XP_PER_ATTEMPT_MAX, clampAttemptScore, levelForXp, xpForAttempt } from './xp'

describe('clampAttemptScore', () => {
  it('keeps a valid score', () => {
    expect(clampAttemptScore(73)).toBe(73)
  })

  it('never returns zero for a completed attempt', () => {
    expect(clampAttemptScore(0)).toBe(ATTEMPT_SCORE_MIN)
    expect(clampAttemptScore(-40)).toBe(ATTEMPT_SCORE_MIN)
  })

  it('caps above the scale', () => {
    expect(clampAttemptScore(140)).toBe(ATTEMPT_SCORE_MAX)
  })

  it('rounds fractional scores', () => {
    expect(clampAttemptScore(72.6)).toBe(73)
  })

  it('falls back to the floor for non-finite input', () => {
    expect(clampAttemptScore(Number.NaN)).toBe(ATTEMPT_SCORE_MIN)
    expect(clampAttemptScore(Number.POSITIVE_INFINITY)).toBe(ATTEMPT_SCORE_MIN)
  })
})

describe('xpForAttempt', () => {
  it('awards the maximum for a perfect attempt', () => {
    expect(xpForAttempt(100)).toBe(XP_PER_ATTEMPT_MAX)
  })

  it('awards at least one XP for any completed attempt', () => {
    expect(xpForAttempt(0)).toBe(1)
    expect(xpForAttempt(1)).toBe(1)
  })

  it('scales with the score', () => {
    expect(xpForAttempt(50)).toBe(10)
    expect(xpForAttempt(80)).toBe(16)
  })

  it('is monotonic across the scale', () => {
    const awards = Array.from({ length: 100 }, (_, index) => xpForAttempt(index + 1))
    for (let index = 1; index < awards.length; index += 1) {
      expect(awards[index]).toBeGreaterThanOrEqual(awards[index - 1])
    }
  })
})

describe('levelForXp', () => {
  it('starts at level 1', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
  })

  it('advances every 100 XP', () => {
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(250)).toBe(3)
  })

  it('guards invalid input', () => {
    expect(levelForXp(Number.NaN)).toBe(1)
    expect(levelForXp(-50)).toBe(1)
  })
})
