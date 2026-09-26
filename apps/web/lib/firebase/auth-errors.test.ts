import { describe, expect, it } from 'vitest'
import { authErrorMessage, AuthFlowError, createGoogleAuthDiagnostic } from './auth-errors'

describe('authErrorMessage', () => {
  it('explains duplicate email signup without hiding the next action', () => {
    expect(authErrorMessage({ code: 'auth/email-already-in-use' }, 'signup')).toContain('Email sudah terdaftar')
  })

  it('explains that Google provider activation is a Firebase configuration gate', () => {
    expect(authErrorMessage({ code: 'auth/operation-not-allowed' }, 'google')).toContain('Google Sign-In belum diaktifkan')
  })

  it.each([
    ['auth/unauthorized-domain', 'Domain aplikasi belum diizinkan'],
    ['auth/invalid-api-key', 'Konfigurasi Firebase aplikasi tidak valid'],
    ['auth/configuration-not-found', 'Konfigurasi Firebase Authentication untuk project ini tidak ditemukan'],
    ['auth/popup-blocked', 'Popup login diblokir browser'],
    ['auth/popup-closed-by-user', 'Login Google dibatalkan'],
    ['auth/cancelled-popup-request', 'Login Google dibatalkan'],
    ['auth/network-request-failed', 'Tidak dapat terhubung ke layanan login'],
    ['auth/internal-error', 'Firebase Authentication gagal memproses login'],
  ])('maps %s to a targeted Google message', (code, message) => {
    expect(authErrorMessage({ code }, 'google')).toContain(message)
  })

  it('keeps existing Google accounts from being described as new-account failures', () => {
    expect(authErrorMessage({ code: 'auth/account-exists-with-different-credential' }, 'google')).toContain('metode login lain')
  })

  it('returns a safe fallback for unknown errors', () => {
    expect(authErrorMessage(new Error('internal'), 'login')).toContain('Login gagal')
  })

  it('distinguishes server-session failures from Firebase popup failures', () => {
    const error = new AuthFlowError('server-session', 500, 'FIREBASE_ADMIN_MISCONFIGURED')

    expect(authErrorMessage(error, 'google')).toContain('server TuturAI gagal membuat sesi')
  })

  it('explains retryable Firebase verification network failures separately', () => {
    const error = new AuthFlowError('server-session', 503, 'FIREBASE_SERVICE_UNAVAILABLE', 'app/network-error')

    expect(authErrorMessage(error, 'google')).toContain('Layanan verifikasi Firebase sedang tidak tersedia')
  })

  it('builds diagnostics from safe fields and excludes the raw error message', () => {
    const error = Object.assign(new Error('raw token must not be logged'), { code: 'auth/unauthorized-domain' })
    const diagnostic = createGoogleAuthDiagnostic(error, {
      failureStage: 'firebase-popup',
      projectId: 'gen-lang-client-0138449759',
      authDomain: 'gen-lang-client-0138449759.firebaseapp.com',
      currentOrigin: 'https://tuturai-apps.netlify.app',
      popupOrRedirect: 'popup',
      environment: 'production',
    })

    expect(diagnostic).toMatchObject({
      provider: 'google',
      firebaseErrorCode: 'auth/unauthorized-domain',
      projectId: 'gen-lang-client-0138449759',
      authDomain: 'gen-lang-client-0138449759.firebaseapp.com',
      currentOrigin: 'https://tuturai-apps.netlify.app',
      popupOrRedirect: 'popup',
      environment: 'production',
      failureStage: 'firebase-popup',
    })
    expect(JSON.stringify(diagnostic)).not.toContain('raw token')
  })
})
