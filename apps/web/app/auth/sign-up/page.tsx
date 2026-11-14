import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignUpForm } from '@/components/auth/sign-up-form'

export default function SignUpPage() {
  return (
    <AuthShell
      title="Buat akun TuturAI"
      subtitle="Gratis untuk siswa, mudah untuk guru. Tidak perlu kartu kredit."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/auth/login" className="rounded-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
            Masuk di sini
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  )
}
