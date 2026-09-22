import { describe, expect, it } from 'vitest'
import { AssignmentRuleError, transitionAssignment, validateAssignmentInput } from './assignment'

describe('validateAssignmentInput', () => {
  it('normalizes a valid assignment payload', () => {
    expect(validateAssignmentInput({
      title: '  Oral presentation  ',
      instructions: 'Record a two-minute response.',
      dueAt: '2026-10-01T12:00:00+07:00',
      maxAttempts: 2,
    })).toEqual({
      success: true,
      data: {
        title: 'Oral presentation',
        instructions: 'Record a two-minute response.',
        dueAt: '2026-10-01T05:00:00.000Z',
        maxAttempts: 2,
      },
    })
  })

  it('rejects invalid due dates and attempt limits', () => {
    const result = validateAssignmentInput({ title: 'Task', instructions: 'Speak.', dueAt: 'not-a-date', maxAttempts: 0 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues.map((issue) => issue.path)).toEqual(['dueAt', 'maxAttempts'])
  })
})

describe('transitionAssignment', () => {
  it('publishes a draft assignment', () => {
    expect(transitionAssignment('draft', 'publish')).toBe('published')
  })

  it('does not republish or mutate an archived assignment', () => {
    expect(() => transitionAssignment('published', 'publish')).toThrowError(
      new AssignmentRuleError('INVALID_TRANSITION', 'Cannot publish an published assignment'),
    )
    expect(() => transitionAssignment('archived', 'archive')).toThrowError(
      new AssignmentRuleError('INVALID_TRANSITION', 'Cannot archive an archived assignment'),
    )
  })
})
