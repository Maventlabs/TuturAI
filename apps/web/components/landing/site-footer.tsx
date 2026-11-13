import Link from 'next/link'
import { Globe } from 'lucide-react'
import { NewsletterForm } from './newsletter-form'

const columns = [
  {
    title: 'Produk',
    links: [
      { label: 'Fitur', href: '#fitur' },
      { label: 'Perangkat Offline', href: '#offline' },
      { label: 'Harga', href: '#harga' },
    ],
  },
  {
    title: 'Mulai',
    links: [
      { label: 'Daftar sebagai Siswa', href: '/auth/sign-up' },
      { label: 'Daftar sebagai Guru', href: '/auth/sign-up' },
      { label: 'Masuk', href: '/auth/login' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Kontak',
    links: [
      { label: 'hello@tuturai.id', href: 'mailto:hello@tuturai.id' },
      { label: 'Aplikasi Web', href: 'https://tuturai-apps.netlify.app' },
      { label: 'Laporan Masalah', href: 'mailto:hello@tuturai.id?subject=Laporan%20Masalah' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer data-nav-theme="blue" className="overflow-hidden bg-primary text-primary-foreground">
      <div className="mx-auto max-w-[1400px] px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-6 lg:gap-8">
          <div className="max-w-sm">
            <h2 className="font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-balance sm:text-4xl">
              Tetap <span className="text-accent-soft">terhubung</span>
            </h2>
            <NewsletterForm />
            <p className="mt-4 text-xs leading-relaxed text-pretty">
              Dengan mendaftar, kamu setuju menerima kabar produk dan tips latihan speaking dari TuturAI.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em]">{column.title}</h3>
              <ul className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-mono text-[11px] uppercase tracking-[0.12em] transition-opacity hover:opacity-75"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            Bahasa Indonesia
          </span>
          <p className="font-mono text-[11px] tracking-[0.12em]">
            © {new Date().getFullYear()} TuturAI. Semua hak dilindungi.
          </p>
        </div>
      </div>

      <div className="mt-14 h-[13.5vw] overflow-hidden" aria-hidden="true">
        <span className="block select-none text-center font-heading text-[25.5vw] font-extrabold leading-[0.8] tracking-[-0.05em]">
          TUTURAI
        </span>
      </div>
    </footer>
  )
}
