import { describe, expect, it } from 'vitest'
import {
  READING_PASSAGE_COUNT,
  READING_QUESTIONS_PER_PASSAGE,
  READING_TOTAL_QUESTIONS,
  calculateReadingScore,
  isReadingLevel,
  validateReadingAnswerInput,
  validateReadingStartInput,
} from './reading'

describe('reading session composition', () => {
  it('is fixed at two passages of five questions', () => {
    expect(READING_PASSAGE_COUNT).toBe(2)
    expect(READING_QUESTIONS_PER_PASSAGE).toBe(5)
    expect(READING_TOTAL_QUESTIONS).toBe(10)
  })
})

describe('calculateReadingScore', () => {
  it('scores the session on a 0..100 scale', () => {
    expect(calculateReadingScore(10, 10)).toBe(100)
    expect(calculateReadingScore(5, 10)).toBe(50)
    expect(calculateReadingScore(4, 10)).toBe(40)
  })

  it('reports an honest zero instead of the attempt floor', () => {
    expect(calculateReadingScore(0, 10)).toBe(0)
  })

  it('never divides by zero', () => {
    expect(calculateReadingScore(0, 0)).toBe(0)
    expect(calculateReadingScore(3, 0)).toBe(0)
  })

  it('clamps impossible counts', () => {
    expect(calculateReadingScore(14, 10)).toBe(100)
    expect(calculateReadingScore(-2, 10)).toBe(0)
  })
})

describe('isReadingLevel', () => {
  it('accepts the three practice levels only', () => {
    expect(isReadingLevel('beginner')).toBe(true)
    expect(isReadingLevel('intermediate')).toBe(true)
    expect(isReadingLevel('advanced')).toBe(true)
    expect(isReadingLevel('expert')).toBe(false)
    expect(isReadingLevel(null)).toBe(false)
  })
})

describe('validateReadingStartInput', () => {
  it('accepts a known level', () => {
    expect(validateReadingStartInput({ level: 'intermediate' })).toEqual({
      success: true,
      data: { level: 'intermediate' },
    })
  })

  it('rejects a missing or unknown level', () => {
    expect(validateReadingStartInput({}).success).toBe(false)
    expect(validateReadingStartInput({ level: 'expert' }).success).toBe(false)
    expect(validateReadingStartInput(null).success).toBe(false)
  })
})

describe('validateReadingAnswerInput', () => {
  it('accepts a question id with an option index', () => {
    expect(validateReadingAnswerInput({ questionId: 'reading-beginner-01-q1', selectedOption: 2 })).toEqual({
      success: true,
      data: { questionId: 'reading-beginner-01-q1', selectedOption: 2 },
    })
  })

  it('rejects a missing id or an out-of-range option', () => {
    expect(validateReadingAnswerInput({ questionId: '', selectedOption: 0 }).success).toBe(false)
    expect(validateReadingAnswerInput({ questionId: 'q1', selectedOption: -1 }).success).toBe(false)
    expect(validateReadingAnswerInput({ questionId: 'q1', selectedOption: 1.5 }).success).toBe(false)
    expect(validateReadingAnswerInput({ questionId: 'q1', selectedOption: 21 }).success).toBe(false)
  })
})
