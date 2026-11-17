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

export const TEACHER_SCORE_MIN = 1
export const TEACHER_SCORE_MAX = 100

export type ScoreSource = 'teacher' | 'ai'

export interface ResolvedScore {
  score: number | null
  source: ScoreSource | null
}

export function isValidTeacherScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= TEACHER_SCORE_MIN &&
    value <= TEACHER_SCORE_MAX
  )
}

/**
 * The teacher's grade always wins over the AI estimate. The AI score is
 * advisory evidence for the teacher, while the number the teacher enters is the
 * one that belongs in the gradebook and the exported report.
 */
export function resolveSubmissionScore(
  teacherScore: number | null | undefined,
  aiScore: number | null | undefined,
): ResolvedScore {
  if (isValidTeacherScore(teacherScore)) return { score: teacherScore, source: 'teacher' }
  if (typeof aiScore === 'number' && Number.isFinite(aiScore) && aiScore >= 0 && aiScore <= 100) {
    return { score: aiScore, source: 'ai' }
  }
  return { score: null, source: null }
}
