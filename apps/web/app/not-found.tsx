import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Link href="/" aria-label="TuturAI, kembali ke beranda">
          <Logo />
        </Link>

        <p className="mt-10 font-mono text-sm font-medium tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-balance font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Halaman ini tidak ditemukan
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Tautannya mungkin sudah berubah atau salah ketik. Kamu bisa kembali ke beranda, atau
          langsung masuk untuk melanjutkan latihan.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">Masuk</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
