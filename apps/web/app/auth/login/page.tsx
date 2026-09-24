import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <AuthShell
      title="Selamat datang kembali"
      subtitle="Masuk untuk melanjutkan latihan speaking-mu."
      footer={
        <>
          Belum punya akun?{' '}
          <Link href="/auth/sign-up" className="font-semibold text-primary hover:underline">
            Daftar gratis
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  )
}
