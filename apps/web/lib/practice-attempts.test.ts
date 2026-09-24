import { describe, expect, it } from 'vitest'
import { validatePracticeAttemptInput } from './practice-attempts'

describe('validatePracticeAttemptInput', () => {
  it('accepts supported speaking practice content', () => {
    expect(validatePracticeAttemptInput({ questionId: 'q-1', contentType: 'pronunciation', idempotencyKey: 'attempt-1' })).toEqual({
      success: true,
      data: { questionId: 'q-1', contentType: 'pronunciation', idempotencyKey: 'attempt-1' },
    })
  })

  it('rejects quiz content types so practice cannot award quiz scores', () => {
    expect(validatePracticeAttemptInput({ questionId: 'q-1', contentType: 'question', idempotencyKey: 'attempt-1' })).toEqual({
      success: false,
      message: 'Unsupported practice type',
    })
  })
})
