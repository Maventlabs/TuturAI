import { describe, expect, it } from 'vitest'
import { DomainRuleError, transitionSubmission } from './submission'

describe('transitionSubmission', () => {
  it('increments the attempt and submits for review', () => {
    expect(transitionSubmission({ status: 'returned', attempt: 1, maxAttempts: 2 }, 'submit')).toEqual({
      status: 'pending_review',
      attempt: 2,
      maxAttempts: 2,
    })
  })

  it('rejects a submission after the attempt limit', () => {
    expect(() => transitionSubmission({ status: 'returned', attempt: 2, maxAttempts: 2 }, 'submit')).toThrowError(
      new DomainRuleError('MAX_ATTEMPTS_REACHED', 'No attempts remaining'),
    )
  })

  it('keeps approved submissions terminal', () => {
    expect(() => transitionSubmission({ status: 'approved', attempt: 1, maxAttempts: 2 }, 'return')).toThrowError(
      new DomainRuleError('APPROVED_TERMINAL', 'Approved submissions cannot change'),
    )
  })
})
