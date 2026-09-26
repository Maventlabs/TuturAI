import { describe, expect, it } from 'vitest'
import { masteredQuestionIds } from './question-bank'
import { isAnswerableContentType } from '@tuturai/domain'

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

  it('does not allow dedicated speaking activities through the generic answer API', () => {
    expect(isAnswerableContentType('question')).toBe(true)
    expect(isAnswerableContentType('vocabulary')).toBe(true)
    expect(isAnswerableContentType('listening')).toBe(true)
    expect(isAnswerableContentType('test')).toBe(true)
    expect(isAnswerableContentType('pronunciation')).toBe(false)
    expect(isAnswerableContentType('speaking')).toBe(false)
    expect(isAnswerableContentType('conversation')).toBe(false)
  })
})
