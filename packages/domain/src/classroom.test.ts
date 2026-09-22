import { describe, expect, it } from 'vitest'
import {
  canAccessRole,
  canJoinClassroom,
  canManageClassroom,
  canManageMembership,
  validateJoinKey,
  validateClassroomInput,
  validateClassroomStatus,
} from './classroom'

describe('classroom join rules', () => {
  it('validates a classroom creation payload', () => {
    expect(validateClassroomInput({ name: '  XI IPA 1 ', description: '  Speaking class ', school: ' SMA 1 ' })).toEqual({
      success: true,
      data: { name: 'XI IPA 1', description: 'Speaking class', school: 'SMA 1' },
    })
  })

  it('rejects a classroom payload with an oversized name', () => {
    expect(validateClassroomInput({ name: 'x'.repeat(121) })).toEqual({
      success: false,
      issues: [{ path: 'name', message: 'Classroom name must be 2-120 characters' }],
    })
  })

  it('normalizes a valid join key before use', () => {
    expect(validateJoinKey(' ab12cd34 ')).toEqual({ success: true, value: 'AB12CD34' })
  })

  it('rejects malformed join keys', () => {
    expect(validateJoinKey('short')).toEqual({
      success: false,
      message: 'Join key must be 8 letters or numbers',
    })
  })

  it('allows only a student to join an active, non-revoked class once', () => {
    expect(
      canJoinClassroom({ role: 'student', classroomStatus: 'active', joinKeyRevoked: false, alreadyMember: false }),
    ).toBe(true)
    expect(
      canJoinClassroom({ role: 'student', classroomStatus: 'active', joinKeyRevoked: false, alreadyMember: true }),
    ).toBe(false)
  })

  it('requires the teacher to own a class before managing it', () => {
    expect(canManageClassroom('teacher', 'teacher-1', 'teacher-1')).toBe(true)
    expect(canManageClassroom('teacher', 'teacher-2', 'teacher-1')).toBe(false)
    expect(canManageClassroom('student', 'teacher-1', 'teacher-1')).toBe(false)
  })

  it('validates classroom lifecycle statuses', () => {
    expect(validateClassroomStatus('archived')).toEqual({ success: true, value: 'archived' })
    expect(validateClassroomStatus('deleted')).toEqual({
      success: false,
      message: 'Classroom status must be active or archived',
    })
  })

  it('allows only the owning teacher to manage another student membership', () => {
    expect(canManageMembership('teacher', 'teacher-1', 'teacher-1', 'student-1')).toBe(true)
    expect(canManageMembership('teacher', 'teacher-2', 'teacher-1', 'student-1')).toBe(false)
    expect(canManageMembership('student', 'student-1', 'teacher-1', 'student-2')).toBe(false)
  })

  it('allows only the required role through an API guard decision', () => {
    expect(canAccessRole('teacher', 'teacher')).toBe(true)
    expect(canAccessRole('student', 'teacher')).toBe(false)
    expect(canAccessRole('student', 'student')).toBe(true)
  })
})
