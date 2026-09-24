import { describe, expect, it } from 'vitest'
import { masteredQuestionIds } from './question-bank'

describe('masteredQuestionIds', () => {
  it('returns only correct attempts for the requested questions', () => {
    expect(masteredQuestionIds(
      ['vocab-1', 'vocab-2'],
      [
        { questionId: 'vocab-1', isCorrect: true },
        { questionId: 'vocab-2', isCorrect: false },
        { questionId: 'other', isCorrect: true },
      ],
    )).toEqual(['vocab-1'])
  })

  it('deduplicates repeated correct attempts', () => {
    expect(masteredQuestionIds(
      ['vocab-1'],
      [
        { questionId: 'vocab-1', isCorrect: true },
        { questionId: 'vocab-1', isCorrect: true },
      ],
    )).toEqual(['vocab-1'])
  })
})
