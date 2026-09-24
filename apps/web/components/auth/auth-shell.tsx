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
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-16 top-10 h-72 w-72 rounded-full bg-accent blur-3xl" />
          <div className="absolute -left-16 bottom-10 h-72 w-72 rounded-full bg-brand blur-3xl" />
        </div>
        <Link href="/" className="relative">
          <span className="flex items-center gap-2">
            <span className="font-heading text-xl font-extrabold">
              Tutur<span className="text-primary-foreground/70">AI</span>
            </span>
          </span>
        </Link>
        <div className="relative">
          <h2 className="max-w-md text-balance font-heading text-3xl font-extrabold leading-tight">
            Berani bicara, tumbuh percaya diri.
          </h2>
          <p className="mt-4 max-w-sm text-pretty text-primary-foreground/80">
            Bergabung dengan ribuan siswa dan guru Indonesia yang berlatih
            speaking Bahasa Inggris bersama TuturAI.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} TuturAI
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
