import Link from 'next/link'
import { Logo } from '@/components/logo'

const columns = [
  {
    title: 'Produk',
    links: [
      { label: 'Fitur', href: '#fitur' },
      { label: 'Cara Kerja', href: '#cara-kerja' },
      { label: 'Untuk Siapa', href: '#untuk-siapa' },
      { label: 'Offline & Hardware', href: '#offline' },
    ],
  },
  {
    title: 'Mulai',
    links: [
      { label: 'Daftar sebagai Siswa', href: '/auth/sign-up' },
      { label: 'Daftar sebagai Guru', href: '/auth/sign-up' },
      { label: 'Masuk', href: '/auth/login' },
    ],
  },
  {
    title: 'Kontak',
    links: [
      { label: 'hello@tuturai.id', href: 'mailto:hello@tuturai.id' },
      { label: 'tuturai-apps.netlify.app', href: 'https://tuturai-apps.netlify.app' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/50">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Logo textClassName="font-display text-xl font-semibold tracking-[-0.02em]" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
              Platform latihan speaking bahasa Inggris berbasis AI untuk siswa SMA/SMK Indonesia.
            </p>
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">
              LIDM VII 2026 · Institut Teknologi Sumatera
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} TuturAI. Semua hak dilindungi.</p>
          <p>Dibuat untuk pendidikan Indonesia.</p>
        </div>
      </div>
    </footer>
  )
}
