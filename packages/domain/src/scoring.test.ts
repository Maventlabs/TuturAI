import { describe, expect, it } from 'vitest'
import { calculateOverallScore } from './scoring'

describe('calculateOverallScore', () => {
  const scores = { pronunciation: 80, fluency: 70, intonation: 60, grammar: 90, vocabulary: 100 }

  it('weights a speaking assessment across all five dimensions', () => {
    expect(calculateOverallScore('speaking', scores)).toBe(81)
  })

  it('prioritizes pronunciation for the pronunciation menu', () => {
    expect(calculateOverallScore('pronunciation', { ...scores, pronunciation: 100 })).toBe(94)
  })

  it('uses grammar and vocabulary weights for conversation', () => {
    expect(calculateOverallScore('conversation', scores)).toBe(82)
  })
})
