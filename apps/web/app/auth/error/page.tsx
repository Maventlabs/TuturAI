import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { TriangleAlert } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-heading text-2xl font-extrabold tracking-tight text-foreground">
          Terjadi kesalahan
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          Tautan otentikasi tidak valid atau sudah kedaluwarsa. Silakan coba
          masuk atau daftar kembali.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/auth/login">Masuk</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/sign-up">Daftar</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
