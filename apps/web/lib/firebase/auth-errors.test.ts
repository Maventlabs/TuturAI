import { describe, expect, it } from 'vitest'
import { authErrorMessage, AuthFlowError, createGoogleAuthDiagnostic, serverConfigField, serverRequestId } from './auth-errors'

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

  it('names the missing Firebase env vars instead of blaming the form input', () => {
    const error = new Error(
      'Firebase Web App configuration is invalid. Check: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_APP_ID',
    )

    const message = authErrorMessage(error, 'signup')

    expect(message).toContain('konfigurasi Firebase aplikasi belum lengkap')
    expect(message).toContain('NEXT_PUBLIC_FIREBASE_API_KEY')
    expect(message).not.toContain('Periksa data')
  })

  it('distinguishes server-session failures from Firebase popup failures', () => {
    const error = new AuthFlowError('server-session', 500, 'FIREBASE_ADMIN_MISCONFIGURED')

    expect(authErrorMessage(error, 'google')).toContain('konfigurasi Firebase Admin')
    expect(authErrorMessage(error, 'signup')).not.toContain('Akun Google')
  })

  it('explains incomplete onboarding data instead of blaming Google', () => {
    const error = new AuthFlowError('onboarding', 400, 'VALIDATION_ERROR')

    expect(authErrorMessage(error, 'google')).toContain('Data profil belum lengkap atau tidak valid')
    expect(authErrorMessage(error, 'signup')).toContain('kelas/mata pelajaran')
  })

  it('does not describe email signup onboarding failures as Google failures', () => {
    const error = new AuthFlowError('onboarding', 500, 'SESSION_CREATION_FAILED')

    expect(authErrorMessage(error, 'signup')).toContain('Akun berhasil dibuat')
    expect(authErrorMessage(error, 'signup')).not.toContain('Akun Google')
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

  it('carries safe request correlation and config field metadata to browser diagnostics', () => {
    const payload = { error: { details: { code: 'FIREBASE_ADMIN_MISCONFIGURED', configField: 'FIREBASE_ADMIN_PRIVATE_KEY' } } }
    const response = new Response(null, { headers: { 'x-request-id': 'nf-request-123' } })
    const error = new AuthFlowError(
      'server-session',
      500,
      'FIREBASE_ADMIN_MISCONFIGURED',
      null,
      serverRequestId(response),
      serverConfigField(payload),
    )
    const diagnostic = createGoogleAuthDiagnostic(error, {
      failureStage: 'firebase-popup',
      projectId: 'gen-lang-client-0138449759',
      authDomain: 'gen-lang-client-0138449759.firebaseapp.com',
      currentOrigin: 'https://tuturai-apps.netlify.app',
      popupOrRedirect: 'popup',
      environment: 'production',
    })

    expect(diagnostic).toMatchObject({ requestId: 'nf-request-123', configField: 'FIREBASE_ADMIN_PRIVATE_KEY' })
    expect(JSON.stringify(diagnostic)).not.toContain('private-key-value')
  })
})
