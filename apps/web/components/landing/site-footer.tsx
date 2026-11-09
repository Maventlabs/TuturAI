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
      { label: 'Email', href: 'mailto:hello@tuturai.id' },
      { label: 'Website', href: 'https://tuturai-apps.netlify.app' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Platform latihan speaking Bahasa Inggris berbasis AI untuk siswa SMA/SMK Indonesia.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">LIDM VII 2026 — Institut Teknologi Sumatera.</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-heading text-sm font-bold text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} TuturAI. Semua hak dilindungi.</p>
          <p>Dibuat untuk pendidikan Indonesia.</p>
        </div>
      </div>
    </footer>
  )
}
