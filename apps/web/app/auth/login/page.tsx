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
          <Link href="/auth/sign-up" className="rounded-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
            Daftar gratis
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  )
}
