import { describe, expect, it } from 'vitest'
import { getQuizCompletionSummary, getScoreNarrative } from './completion'

describe('getQuizCompletionSummary', () => {
  it('returns an encouraging high-score completion message', () => {
    expect(getQuizCompletionSummary(8, 10)).toEqual({
      title: 'Luar biasa!',
      message: 'Kamu menjawab 8 dari 10 soal dengan benar.',
    })
  })

  it('does not claim a successful score when no questions were completed', () => {
    expect(getQuizCompletionSummary(0, 0).title).toBe('Terus berlatih!')
  })
})

describe('getScoreNarrative', () => {
  it('celebrates a strong score', () => {
    expect(getScoreNarrative(92)).toMatchObject({ tone: 'high', title: 'Hebat!' })
  })

  it('keeps a weak score encouraging', () => {
    const narrative = getScoreNarrative(18)
    expect(narrative.tone).toBe('low')
    expect(narrative.title).toBe('Jangan berkecil hati')
    expect(narrative.message).not.toMatch(/gagal|bodoh|buruk/i)
  })

  it('clamps out-of-range and non-finite scores instead of inventing a band', () => {
    expect(getScoreNarrative(140).tone).toBe('high')
    expect(getScoreNarrative(-20).tone).toBe('low')
    expect(getScoreNarrative(Number.NaN).tone).toBe('low')
  })
})
