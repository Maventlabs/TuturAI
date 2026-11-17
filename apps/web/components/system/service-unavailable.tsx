import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export function ServiceUnavailable() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Link href="/" aria-label="TuturAI, kembali ke beranda">
          <Logo />
        </Link>

        <p className="mt-10 font-mono text-sm font-medium tracking-widest text-muted-foreground">503</p>
        <h1 className="mt-3 text-balance font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Data kamu belum bisa dimuat
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Kamu sudah masuk, tapi server data sedang tidak bisa diakses. Coba muat ulang halaman ini
          beberapa saat lagi.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/dashboard">Coba lagi</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
