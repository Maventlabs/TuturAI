'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'

const navItems = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
  { label: 'Untuk Siapa', href: '#untuk-siapa' },
  { label: 'Harga', href: '#harga' },
]

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border bg-background/80 backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="TuturAI beranda">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Masuk</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/sign-up">Coba Gratis</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Navigasi seluler">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Button variant="outline" asChild>
                <Link href="/auth/login">Masuk</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Coba Gratis</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
