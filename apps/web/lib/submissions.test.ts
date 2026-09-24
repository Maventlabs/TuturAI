import { describe, expect, it } from 'vitest'
import { isSubmissionAwaitingReview } from './submissions'

describe('isSubmissionAwaitingReview', () => {
  it('includes submitted and pending_review submissions', () => {
    expect(isSubmissionAwaitingReview('submitted')).toBe(true)
    expect(isSubmissionAwaitingReview('pending_review')).toBe(true)
  })

  it('excludes approved and returned submissions', () => {
    expect(isSubmissionAwaitingReview('approved')).toBe(false)
    expect(isSubmissionAwaitingReview('returned')).toBe(false)
  })
})
