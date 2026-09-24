type FirebaseAuthError = { code?: string }

export function authErrorMessage(error: unknown, action: 'login' | 'signup' | 'google') {
  const code = (error as FirebaseAuthError | null)?.code

  if (code === 'auth/email-already-in-use') {
    return 'Email sudah terdaftar. Gunakan halaman Masuk untuk melanjutkan ke akun tersebut.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In belum diaktifkan pada Firebase project. Aktifkan Authentication > Sign-in method > Google, lalu coba lagi.'
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Email ini sudah terdaftar dengan metode login lain. Gunakan login email dan kata sandi.'
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Login Google dibatalkan.'
  }
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return 'Email atau kata sandi salah.'
  }
  if (code === 'auth/weak-password') {
    return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.'
  }
  if (code === 'auth/invalid-email') {
    return 'Format email tidak valid.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi gagal. Periksa jaringan lalu coba lagi.'
  }

  if (action === 'google') return 'Login Google gagal. Periksa konfigurasi Firebase lalu coba lagi.'
  if (action === 'login') return 'Login gagal. Periksa email, kata sandi, dan konfigurasi Firebase.'
  return 'Akun tidak dapat dibuat. Periksa data dan konfigurasi Firebase.'
}
