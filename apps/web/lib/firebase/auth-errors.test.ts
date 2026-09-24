import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './auth-errors'

describe('authErrorMessage', () => {
  it('explains duplicate email signup without hiding the next action', () => {
    expect(authErrorMessage({ code: 'auth/email-already-in-use' }, 'signup')).toContain('Email sudah terdaftar')
  })

  it('explains that Google provider activation is a Firebase configuration gate', () => {
    expect(authErrorMessage({ code: 'auth/operation-not-allowed' }, 'google')).toContain('Google Sign-In belum diaktifkan')
  })

  it('keeps existing Google accounts from being described as new-account failures', () => {
    expect(authErrorMessage({ code: 'auth/account-exists-with-different-credential' }, 'google')).toContain('metode login lain')
  })

  it('returns a safe fallback for unknown errors', () => {
    expect(authErrorMessage(new Error('internal'), 'login')).toContain('Login gagal')
  })
})
