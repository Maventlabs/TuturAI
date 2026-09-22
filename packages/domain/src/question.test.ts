import { describe, expect, it } from 'vitest'
import { validateQuestionAnswerInput } from './question'

describe('validateQuestionAnswerInput', () => {
  it('accepts a bounded answer payload', () => {
    expect(validateQuestionAnswerInput({ questionId: 'q-1', selectedOption: 2, attemptId: 'attempt-1' })).toEqual({
      success: true,
      data: { questionId: 'q-1', selectedOption: 2, attemptId: 'attempt-1' },
    })
  })

  it('rejects missing ids and non-integer options', () => {
    const result = validateQuestionAnswerInput({ questionId: '', selectedOption: '2', attemptId: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues.map((issue) => issue.path)).toEqual(['questionId', 'attemptId', 'selectedOption'])
  })
})
