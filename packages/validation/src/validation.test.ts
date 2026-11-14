import { describe, expect, it } from 'vitest'
import { validateNewsletterInput, validateOnboardingInput, validateProfileUpdateInput } from './validation'

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
    expect(validateOnboardingInput({ displayName: '  Budi  ', school: ' SMA 1 ', role: 'student', className: ' XI IPA 2 ' })).toEqual({
      success: true,
      data: { displayName: 'Budi', school: 'SMA 1', role: 'student', className: 'XI IPA 2' },
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

describe('validateProfileUpdateInput', () => {
  it('trims editable profile fields', () => {
    expect(validateProfileUpdateInput({ displayName: '  Budi  ', school: ' SMA 1 ' })).toEqual({
      success: true,
      data: { displayName: 'Budi', school: 'SMA 1' },
    })
  })

  it('rejects role and progress fields instead of accepting client mutations', () => {
    expect(validateProfileUpdateInput({ displayName: 'Budi', school: 'SMA 1', role: 'teacher', xp: 9999 })).toEqual({
      success: false,
      issues: [{ path: '', message: 'Only displayName and school can be updated' }],
    })
  })

  it('rejects undersized profile fields', () => {
    expect(validateProfileUpdateInput({ displayName: 'B', school: 'X' })).toEqual({
      success: false,
      issues: [
        { path: 'displayName', message: 'Display name must be 2-120 characters' },
        { path: 'school', message: 'School must be 2-160 characters' },
      ],
    })
  })
})

describe('validateNewsletterInput', () => {
  it('normalizes a valid email', () => {
    expect(validateNewsletterInput({ email: '  Budi@Example.COM ' })).toEqual({
      success: true,
      data: { email: 'budi@example.com' },
    })
  })

  it('rejects missing input', () => {
    expect(validateNewsletterInput(null)).toEqual({
      success: false,
      issues: [{ path: 'email', message: 'Email is required' }],
    })
  })

  it('rejects malformed addresses', () => {
    for (const email of ['budi', 'budi@', '@example.com', 'budi@example', 'a b@example.com']) {
      expect(validateNewsletterInput({ email })).toEqual({
        success: false,
        issues: [{ path: 'email', message: 'Enter a valid email address' }],
      })
    }
  })
})
