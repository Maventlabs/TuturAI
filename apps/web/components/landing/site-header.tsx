'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

type PanelItem = {
  label: string
  href: string
}

type NavEntry = {
  id: string
  label: string
  href: string
  panel?: PanelItem[]
}

const navEntries: NavEntry[] = [
  { id: 'kenapa', label: 'Kenapa TuturAI', href: '#masalah' },
  {
    id: 'produk',
    label: 'Produk',
    href: '#fitur',
    panel: [
      { label: 'Latihan Speaking AI', href: '#fitur' },
      { label: 'Perangkat Offline', href: '#offline' },
      { label: 'Analitik Guru', href: '#fitur' },
      { label: 'Sinkron Luring', href: '#offline' },
    ],
  },
  {
    id: 'solusi',
    label: 'Solusi',
    href: '#fitur',
    panel: [
      { label: 'Untuk Siswa', href: '#fitur' },
      { label: 'Untuk Guru', href: '#fitur' },
      { label: 'Untuk Sekolah', href: '#harga' },
      { label: 'Kecemasan Berbicara', href: '#masalah' },
    ],
  },
  {
    id: 'sumber-daya',
    label: 'Sumber Daya',
    href: '#faq',
    panel: [
      { label: 'FAQ', href: '#faq' },
      { label: 'Harga & Paket', href: '#harga' },
      { label: 'Cara Kerja', href: '#fitur' },
      { label: 'Mulai Sekarang', href: '/auth/sign-up' },
    ],
  },
  { id: 'harga', label: 'Harga', href: '#harga' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [canHover, setCanHover] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), (user) => setAuthed(Boolean(user)))
    } catch {
      // Auth is unavailable (no Firebase config in this environment); the
      // header already defaults to the signed-out state.
    }
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hover-to-open only where a real pointer exists, so a tap on touch devices
  // does not open the panel and immediately toggle it shut.
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setCanHover(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!openMenu) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [openMenu])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          shellRef.current,
          { y: -16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
        )
      })
      return () => mm.revert()
    },
    { scope: shellRef },
  )

  const closeAll = () => {
    setOpen(false)
    setOpenMenu(null)
    setOpenGroup(null)
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        'sticky top-0 z-50 border-b bg-background transition-colors duration-200',
        scrolled ? 'border-border' : 'border-transparent',
      )}
    >
      <header
        ref={headerRef}
        onMouseLeave={() => setOpenMenu(null)}
        className="relative mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:grid lg:h-18 lg:grid-cols-[1fr_auto_1fr] lg:px-8"
      >
        <Link href="/" aria-label="TuturAI beranda" className="shrink-0">
          <Logo textClassName="font-heading text-xl font-extrabold tracking-tight" />
        </Link>

        <nav className="hidden items-center justify-center gap-1 lg:flex" aria-label="Navigasi utama">
          {navEntries.map((entry) =>
            entry.panel ? (
              <div key={entry.id} className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === entry.id}
                  aria-controls={`nav-panel-${entry.id}`}
                  onMouseEnter={() => canHover && setOpenMenu(entry.id)}
                  onClick={() => setOpenMenu((current) => (current === entry.id ? null : entry.id))}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    openMenu === entry.id
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {entry.label}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      openMenu === entry.id && 'rotate-180',
                    )}
                  />
                </button>

                {openMenu === entry.id && (
                  <div
                    id={`nav-panel-${entry.id}`}
                    className="absolute left-0 top-full pt-2"
                  >
                    <ul className="flex w-56 flex-col rounded-xl border border-border bg-card p-1.5 shadow-[0_24px_60px_-32px_rgba(29,29,31,0.35)]">
                      {entry.panel.map((item) => (
                        <li key={item.label}>
                          <Link
                            href={item.href}
                            onClick={() => setOpenMenu(null)}
                            className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <a
                key={entry.id}
                href={entry.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {entry.label}
              </a>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:justify-end">
          {authed ? (
            <Link
              href="/dashboard"
              className="hidden h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] lg:inline-flex"
            >
              Dashboard
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary lg:inline-flex"
              >
                Masuk
              </Link>
              <Link
                href="/auth/sign-up"
                className="hidden h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] lg:inline-flex"
              >
                Coba Gratis
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary lg:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>

      </header>

      {open && (
        <div id="mobile-nav" className="absolute inset-x-0 top-full lg:hidden">
          <div className="mx-4 mb-3 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-border bg-card shadow-[0_24px_60px_-32px_rgba(29,29,31,0.35)] sm:mx-6">
            <nav aria-label="Navigasi seluler" className="flex flex-col px-2 py-1">
              {navEntries.map((entry) =>
                entry.panel ? (
                  <div key={entry.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenGroup((current) => (current === entry.id ? null : entry.id))}
                      aria-expanded={openGroup === entry.id}
                      aria-controls={`mobile-group-${entry.id}`}
                      className="flex w-full items-center justify-between px-3 py-4 text-left text-base font-medium text-foreground"
                    >
                      {entry.label}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'h-5 w-5 text-muted-foreground transition-transform duration-200',
                          openGroup === entry.id && 'rotate-180',
                        )}
                      />
                    </button>
                    {openGroup === entry.id && (
                      <ul id={`mobile-group-${entry.id}`} className="pb-3">
                        {entry.panel.map((item) => (
                          <li key={item.label}>
                            <Link
                              href={item.href}
                              onClick={closeAll}
                              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <a
                    key={entry.id}
                    href={entry.href}
                    onClick={closeAll}
                    className="border-b border-border px-3 py-4 text-base font-medium text-foreground last:border-b-0"
                  >
                    {entry.label}
                  </a>
                ),
              )}
            </nav>
            <div className="flex flex-col gap-2 border-t border-border p-3">
              {authed ? (
                <Link
                  href="/dashboard"
                  onClick={closeAll}
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Dashboard
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={closeAll}
                    className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-foreground"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    onClick={closeAll}
                    className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Coba Gratis
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
