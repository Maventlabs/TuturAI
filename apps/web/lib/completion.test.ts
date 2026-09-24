import { describe, expect, it } from 'vitest'
import { getQuizCompletionSummary } from './completion'

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
