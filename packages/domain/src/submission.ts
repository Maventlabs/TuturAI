import type { SubmissionStatus, UserRole } from './types'

export type SubmissionAction = 'submit' | 'approve' | 'return'

export interface SubmissionState {
  status: SubmissionStatus
  attempt: number
  maxAttempts: number
}

export class DomainRuleError extends Error {
  constructor(
    public readonly code: 'MAX_ATTEMPTS_REACHED' | 'APPROVED_TERMINAL' | 'INVALID_TRANSITION',
    message: string,
  ) {
    super(message)
    this.name = 'DomainRuleError'
  }
}

export function transitionSubmission(
  state: SubmissionState,
  action: SubmissionAction,
): SubmissionState {
  if (!Number.isInteger(state.attempt) || state.attempt < 0 || !Number.isInteger(state.maxAttempts) || state.maxAttempts < 1) {
    throw new DomainRuleError('INVALID_TRANSITION', 'Submission attempt limits are invalid')
  }
  if (state.status === 'approved') {
    throw new DomainRuleError('APPROVED_TERMINAL', 'Approved submissions cannot change')
  }

  if (action === 'submit') {
    if (!['assigned', 'in_progress', 'returned'].includes(state.status)) {
      throw new DomainRuleError('INVALID_TRANSITION', 'Submission is not ready to submit')
    }
    if (state.attempt >= state.maxAttempts) {
      throw new DomainRuleError('MAX_ATTEMPTS_REACHED', 'No attempts remaining')
    }
    return { ...state, status: 'pending_review', attempt: state.attempt + 1 }
  }

  if (!['submitted', 'pending_review'].includes(state.status)) {
    throw new DomainRuleError('INVALID_TRANSITION', 'Submission is not awaiting review')
  }

  return { ...state, status: action === 'approve' ? 'approved' : 'returned' }
}

export function canTeacherReviewSubmission(role: UserRole, ownsClassroom: boolean): boolean {
  return role === 'teacher' && ownsClassroom
}
