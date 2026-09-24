import Link from 'next/link'
import { Logo } from '@/components/logo'

const columns = [
  {
    title: 'Produk',
    links: [
      { label: 'Fitur', href: '#fitur' },
      { label: 'Cara Kerja', href: '#cara-kerja' },
      { label: 'Harga', href: '#harga' },
    ],
  },
  {
    title: 'Perusahaan',
    links: [
      { label: 'Tentang', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Karier', href: '#' },
    ],
  },
  {
    title: 'Dukungan',
    links: [
      { label: 'Bantuan', href: '#' },
      { label: 'Kontak', href: '#' },
      { label: 'Privasi', href: '#' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Platform latihan speaking Bahasa Inggris berbasis AI untuk siswa
              SMA/SMK Indonesia.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-heading text-sm font-bold text-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
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
