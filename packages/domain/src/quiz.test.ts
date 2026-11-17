import { describe, expect, it } from 'vitest'
import {
  QUIZ_DURATION_MS,
  QUIZ_QUESTIONS_PER_SECTION,
  QUIZ_TOTAL_QUESTIONS,
  calculateQuizScore,
  calculateQuizSectionScore,
  formatQuizClock,
  remainingQuizMs,
  validateQuizAnswerInput,
  validateQuizStartInput,
} from './quiz'

const tally = (correct: number, incorrect: number, unanswered: number) => ({ correct, incorrect, unanswered })

describe('quiz composition', () => {
  it('is fixed at 30 questions and 30 minutes', () => {
    expect(QUIZ_TOTAL_QUESTIONS).toBe(30)
    expect(QUIZ_QUESTIONS_PER_SECTION).toBe(10)
    expect(QUIZ_DURATION_MS).toBe(30 * 60 * 1_000)
  })
})

describe('calculateQuizSectionScore', () => {
  it('scores a section on its own 0..100 scale', () => {
    expect(calculateQuizSectionScore(10, 10)).toBe(100)
    expect(calculateQuizSectionScore(5, 10)).toBe(50)
    expect(calculateQuizSectionScore(0, 10)).toBe(0)
  })

  it('never divides by zero', () => {
    expect(calculateQuizSectionScore(0, 0)).toBe(0)
    expect(calculateQuizSectionScore(3, 0)).toBe(0)
  })

  it('clamps impossible counts', () => {
    expect(calculateQuizSectionScore(14, 10)).toBe(100)
    expect(calculateQuizSectionScore(-2, 10)).toBe(0)
  })
})

describe('calculateQuizScore', () => {
  it('gives a perfect attempt 100', () => {
    const score = calculateQuizScore({
      reading: tally(10, 0, 0),
      listening: tally(10, 0, 0),
      general: tally(10, 0, 0),
    })
    expect(score.finalScore).toBe(100)
    expect(score.correct).toBe(30)
    expect(score.total).toBe(30)
  })

  it('weights the three sections equally', () => {
    const score = calculateQuizScore({
      reading: tally(10, 0, 0),
      listening: tally(0, 10, 0),
      general: tally(0, 10, 0),
    })
    expect(score.finalScore).toBe(33)
    expect(score.sections.map((section) => section.score)).toEqual([100, 0, 0])
  })

  it('counts unanswered answers as not correct', () => {
    const score = calculateQuizScore({
      reading: tally(5, 0, 5),
      listening: tally(5, 0, 5),
      general: tally(5, 0, 5),
    })
    expect(score.finalScore).toBe(50)
    expect(score.unanswered).toBe(15)
    expect(score.incorrect).toBe(0)
  })

  it('never returns zero for a completed attempt', () => {
    const score = calculateQuizScore({
      reading: tally(0, 10, 0),
      listening: tally(0, 10, 0),
      general: tally(0, 10, 0),
    })
    expect(score.finalScore).toBe(1)
  })

  it('reports per-section totals that add up to the exam size', () => {
    const score = calculateQuizScore({
      reading: tally(7, 2, 1),
      listening: tally(4, 5, 1),
      general: tally(9, 1, 0),
    })
    expect(score.total).toBe(30)
    expect(score.sections.reduce((sum, section) => sum + section.total, 0)).toBe(30)
    expect(score.correct).toBe(20)
  })
})

describe('remainingQuizMs', () => {
  it('counts down and never goes negative', () => {
    expect(remainingQuizMs(1_000, 400)).toBe(600)
    expect(remainingQuizMs(1_000, 1_500)).toBe(0)
  })
})

describe('formatQuizClock', () => {
  it('renders MM:SS', () => {
    expect(formatQuizClock(30 * 60 * 1_000)).toBe('30:00')
    expect(formatQuizClock(65_000)).toBe('01:05')
    expect(formatQuizClock(0)).toBe('00:00')
  })
})

describe('validateQuizStartInput', () => {
  it('accepts the three levels', () => {
    expect(validateQuizStartInput({ level: 'beginner' }).success).toBe(true)
    expect(validateQuizStartInput({ level: 'advanced' }).success).toBe(true)
  })

  it('rejects anything else', () => {
    expect(validateQuizStartInput({ level: 'expert' }).success).toBe(false)
    expect(validateQuizStartInput(null).success).toBe(false)
  })
})

describe('validateQuizAnswerInput', () => {
  it('accepts a valid answer', () => {
    const result = validateQuizAnswerInput({ questionId: 'reading-beginner-01-q1', selectedOption: 2 })
    expect(result.success).toBe(true)
  })

  it('rejects a missing question or an out-of-range option', () => {
    expect(validateQuizAnswerInput({ questionId: '', selectedOption: 1 }).success).toBe(false)
    expect(validateQuizAnswerInput({ questionId: 'q1', selectedOption: 25 }).success).toBe(false)
    expect(validateQuizAnswerInput({ questionId: 'q1', selectedOption: 1.5 }).success).toBe(false)
  })
})
