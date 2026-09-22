import { describe, expect, it } from 'vitest'
import { validateOnboardingInput } from './validation'

describe('validateOnboardingInput', () => {
  it('keeps role-specific onboarding fields when valid', () => {
    expect(
      validateOnboardingInput({
        displayName: '  Budi  ',
        school: ' SMA 1 ',
        role: 'student',
        className: ' XI IPA 2 ',
      }),
    ).toEqual({
      success: true,
      data: { displayName: 'Budi', school: 'SMA 1', role: 'student', className: 'XI IPA 2' },
    })
  })

  it('trims valid fields', () => {
    expect(validateOnboardingInput({ displayName: '  Budi  ', school: ' SMA 1 ', role: 'student' })).toEqual({
      success: true,
      data: { displayName: 'Budi', school: 'SMA 1', role: 'student' },
    })
  })

  it('rejects missing input', () => {
    expect(validateOnboardingInput(null)).toEqual({
      success: false,
      issues: [{ path: '', message: 'Input is required' }],
    })
  })

  it('rejects invalid role and undersized fields', () => {
    const result = validateOnboardingInput({ displayName: 'A', school: 'X', role: 'admin' })
    expect(result).toEqual({
      success: false,
      issues: [
        { path: 'displayName', message: 'Display name must be 2-120 characters' },
        { path: 'school', message: 'School must be 2-160 characters' },
        { path: 'role', message: 'Role must be student or teacher' },
      ],
    })
  })
})
