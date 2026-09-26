export type GoogleAuthFailureStage = 'firebase-popup' | 'server-session' | 'onboarding'

type FirebaseAuthErrorLike = { code?: unknown }

export class AuthFlowError extends Error {
  constructor(
    public readonly stage: Exclude<GoogleAuthFailureStage, 'firebase-popup'>,
    public readonly httpStatus: number,
    public readonly serverErrorCode: string | null,
    public readonly firebaseErrorCode: string | null = null,
  ) {
    super('Authentication flow failed')
    this.name = 'AuthFlowError'
  }
}

export function firebaseAuthErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const code = (error as FirebaseAuthErrorLike).code
  return typeof code === 'string' && code.startsWith('auth/') ? code : null
}

export function serverAuthErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null
  const apiError = payload.error
  if (!apiError || typeof apiError !== 'object') return null
  const details = 'details' in apiError && apiError.details && typeof apiError.details === 'object'
    ? apiError.details
    : null
  const detailCode = details && 'code' in details ? details.code : null
  const envelopeCode = 'code' in apiError ? apiError.code : null
  const code = typeof detailCode === 'string' ? detailCode : envelopeCode
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : null
}

export function serverFirebaseAuthErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null
  const apiError = payload.error
  if (!apiError || typeof apiError !== 'object' || !('details' in apiError)) return null
  const details = apiError.details
  if (!details || typeof details !== 'object' || !('firebaseErrorCode' in details)) return null
  const code = details.firebaseErrorCode
  return typeof code === 'string' && /^(auth|app)\/[a-z0-9-]+$/i.test(code) ? code : null
}

export function authErrorMessage(error: unknown, action: 'login' | 'signup' | 'google') {
  if (error instanceof AuthFlowError) {
    if (error.serverErrorCode === 'FIREBASE_ADMIN_MISCONFIGURED') {
      return 'Akun Google berhasil dipilih, tetapi server TuturAI gagal membuat sesi Firebase karena konfigurasi Admin.'
    }
    if (error.serverErrorCode === 'FIREBASE_PROJECT_MISMATCH') {
      return 'Project Firebase aplikasi dan server tidak sama. Admin perlu menyamakan konfigurasi project.'
    }
    if (error.serverErrorCode === 'SESSION_NETWORK_ERROR' || error.serverErrorCode === 'FIREBASE_SERVICE_UNAVAILABLE') {
      return 'Layanan verifikasi Firebase sedang tidak tersedia. Periksa koneksi lalu coba lagi.'
    }
    if (error.serverErrorCode === 'FIREBASE_ID_TOKEN_REJECTED') {
      return 'Akun Google berhasil dipilih, tetapi server TuturAI tidak dapat memverifikasi sesi Firebase.'
    }
    if (error.stage === 'onboarding') {
      return 'Akun Google berhasil dipilih, tetapi profil awal TuturAI gagal disimpan. Coba lagi.'
    }
    return 'Akun Google berhasil dipilih, tetapi sesi server TuturAI gagal dibuat. Coba lagi.'
  }

  const code = firebaseAuthErrorCode(error)
  if (code === 'auth/unauthorized-domain') {
    return 'Domain aplikasi belum diizinkan di Firebase Authentication.'
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/invalid-app-id') {
    return 'Konfigurasi Firebase aplikasi tidak valid.'
  }
  if (code === 'auth/configuration-not-found' || code === 'auth/auth-domain-config-required') {
    return 'Konfigurasi Firebase Authentication untuk project ini tidak ditemukan.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In belum diaktifkan pada Firebase Authentication.'
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup login diblokir browser. Izinkan popup lalu coba lagi.'
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Login Google dibatalkan.'
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Email ini sudah terdaftar dengan metode login lain. Gunakan metode tersebut untuk masuk.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Tidak dapat terhubung ke layanan login. Periksa koneksi lalu coba lagi.'
  }
  if (code === 'auth/internal-error') {
    return 'Firebase Authentication gagal memproses login. Coba lagi.'
  }
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return action === 'google'
      ? 'Firebase tidak dapat memverifikasi credential Google yang diterima.'
      : 'Email atau kata sandi salah.'
  }
  if (code === 'auth/weak-password') {
    return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.'
  }
  if (code === 'auth/invalid-email') {
    return 'Format email tidak valid.'
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email sudah terdaftar. Gunakan halaman Masuk untuk melanjutkan ke akun tersebut.'
  }

  if (action === 'google') return 'Login Google gagal. Silakan coba lagi.'
  if (action === 'login') return 'Login gagal. Periksa email dan kata sandi lalu coba lagi.'
  return 'Akun tidak dapat dibuat. Periksa data lalu coba lagi.'
}

export interface GoogleAuthDiagnosticContext {
  failureStage: GoogleAuthFailureStage
  projectId: string | null
  authDomain: string | null
  currentOrigin: string | null
  popupOrRedirect: 'popup' | 'redirect'
  environment: 'production' | 'development' | 'test' | 'unknown'
}

export function createGoogleAuthDiagnostic(error: unknown, context: GoogleAuthDiagnosticContext) {
  const flowError = error instanceof AuthFlowError ? error : null
  return {
    provider: 'google' as const,
    firebaseErrorCode: flowError?.firebaseErrorCode ?? firebaseAuthErrorCode(error),
    projectId: context.projectId,
    authDomain: context.authDomain,
    currentOrigin: context.currentOrigin,
    popupOrRedirect: context.popupOrRedirect,
    environment: context.environment,
    failureStage: flowError?.stage ?? context.failureStage,
    httpStatus: flowError?.httpStatus ?? null,
    serverErrorCode: flowError?.serverErrorCode ?? null,
  }
}

export function logGoogleAuthFailure(error: unknown, context: GoogleAuthDiagnosticContext) {
  console.error('[TuturAI Google Auth Diagnostic]', createGoogleAuthDiagnostic(error, context))
}
