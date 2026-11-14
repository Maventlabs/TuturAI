import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/logo'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — the landing illustration carries the identity, so the
          panel reads as part of the product instead of a flat colour block. */}
      <aside className="relative hidden overflow-hidden bg-ink-deep lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/landing/hero-bg.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
          style={{ objectPosition: 'left center' }}
        />
        <div
          className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-ink-deep/65 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-ink-deep via-ink-deep/70 to-transparent"
          aria-hidden
        />

        <div className="relative p-10 xl:p-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Image
              src="/brand/logo-mark-white.png"
              alt=""
              width={36}
              height={38}
              priority
              className="h-9 w-auto shrink-0"
            />
            <span className="font-heading text-xl font-extrabold tracking-tight text-white">
              TuturAI
            </span>
          </Link>
        </div>

        <div className="relative px-10 pb-10 xl:px-12 xl:pb-12">
          <h2 className="max-w-lg text-pretty font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-white xl:text-5xl">
            Berani bicara, tumbuh percaya diri.
          </h2>
          <p className="mt-5 max-w-sm text-pretty text-[15px] leading-relaxed text-white/75">
            Bergabung dengan ribuan siswa dan guru Indonesia yang berlatih
            speaking Bahasa Inggris bersama TuturAI.
          </p>
          <p className="mt-10 text-sm text-white/55">
            © {new Date().getFullYear()} TuturAI
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center border-border px-6 py-10 sm:px-12 lg:border-l lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Logo />
            </Link>
          </div>
          <h1 className="text-balance font-heading text-[2rem] font-extrabold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2.5 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
          <div className="mt-8">{children}</div>
          {footer && (
            <div className="mt-7 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
