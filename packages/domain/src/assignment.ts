import type { AssignmentStatus } from './types'

export interface AssignmentInput {
  title: string
  instructions: string
  dueAt: string | null
  maxAttempts: number
}

export type AssignmentAction = 'publish' | 'archive'

export class AssignmentRuleError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'INVALID_TRANSITION',
    message: string,
  ) {
    super(message)
    this.name = 'AssignmentRuleError'
  }
}

export function validateAssignmentInput(input: unknown):
  | { success: true; data: AssignmentInput }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Assignment payload is required' }] }
  }

  const value = input as Record<string, unknown>
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const instructions = typeof value.instructions === 'string' ? value.instructions.trim() : ''
  const dueAt = value.dueAt === undefined || value.dueAt === null || value.dueAt === ''
    ? null
    : typeof value.dueAt === 'string' && !Number.isNaN(Date.parse(value.dueAt))
      ? new Date(value.dueAt).toISOString()
      : null
  const maxAttempts = value.maxAttempts === undefined ? 1 : value.maxAttempts
  const issues: Array<{ path: string; message: string }> = []

  if (title.length < 2 || title.length > 160) issues.push({ path: 'title', message: 'Assignment title must be 2-160 characters' })
  if (instructions.length < 1 || instructions.length > 5000) issues.push({ path: 'instructions', message: 'Assignment instructions must be 1-5000 characters' })
  if (value.dueAt !== undefined && value.dueAt !== null && value.dueAt !== '' && dueAt === null) {
    issues.push({ path: 'dueAt', message: 'Due date must be a valid date' })
  }
  if (!Number.isInteger(maxAttempts) || (maxAttempts as number) < 1 || (maxAttempts as number) > 10) {
    issues.push({ path: 'maxAttempts', message: 'Max attempts must be an integer from 1-10' })
  }

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { title, instructions, dueAt, maxAttempts: maxAttempts as number } }
}

export function transitionAssignment(status: AssignmentStatus, action: AssignmentAction): AssignmentStatus {
  if (action === 'publish' && status === 'draft') return 'published'
  if (action === 'archive' && status !== 'archived') return 'archived'
  throw new AssignmentRuleError('INVALID_TRANSITION', `Cannot ${action} an ${status} assignment`)
}
