'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Menu, X, ChevronDown, ArrowUpRight } from 'lucide-react'
import { Logo } from '@/components/logo'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const leftItems = [
  { label: 'Features', href: '#fitur' },
  { label: 'Why TuturAI', href: '#masalah' },
  { label: 'Harga', href: '#harga' },
]

const productItems = [
  { label: 'Untuk Siswa', href: '#untuk-siapa', desc: 'Ruang aman untuk bicara' },
  { label: 'Untuk Guru', href: '#untuk-siapa', desc: 'Dashboard analitik kelas' },
  { label: 'Perangkat Offline', href: '#offline', desc: 'Konsol genggam ESP32-S3' },
  { label: 'Cara Kerja', href: '#cara-kerja', desc: 'Tiga langkah mulai' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [authed, setAuthed] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

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

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          shellRef.current,
          { y: -24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
        )
      })

      // Hide on scroll down, reveal on scroll up. Desktop only, so the mobile
      // drawer can never slide out of reach.
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const setY = gsap.quickTo(shellRef.current, 'y', { duration: 0.35, ease: 'power2.out' })
        const trigger = ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: (self) => setY(self.scroll() > 320 && self.direction === 1 ? -96 : 0),
        })
        return () => trigger.kill()
      })

      return () => mm.revert()
    },
    { scope: shellRef },
  )

  useGSAP(
    () => {
      if (!open || !drawerRef.current) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          drawerRef.current,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
        )
      })
      return () => mm.revert()
    },
    { dependencies: [open] },
  )

  return (
    <div ref={shellRef} className="fixed inset-x-0 top-3 z-50 px-3 sm:px-4">
      <header className="relative mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 rounded-lg border border-border bg-background/85 px-4 shadow-[0_8px_40px_-20px_rgba(29,29,31,0.35)] backdrop-blur-xl">
        <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {leftItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-haspopup="true"
            >
              Products
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full z-50 mt-1 w-64 translate-y-1 rounded-lg border border-border bg-card p-2 opacity-0 shadow-[0_16px_48px_-20px_rgba(29,29,31,0.35)] transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {productItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary"
                >
                  <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.desc}</span>
                </a>
              ))}
            </div>
          </div>
        </nav>

        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Wordmark sits at the exact centre, independent of the side widths. */}
        <Link
          href="/"
          aria-label="TuturAI beranda"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <Logo textClassName="font-display text-xl font-semibold tracking-[-0.02em]" />
        </Link>

        <div className="ml-auto hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex">
          {authed ? (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Dashboard
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Login
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign Up
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
        <span className="w-11 shrink-0 lg:hidden" aria-hidden />
      </header>

      {open && (
        <div
          ref={drawerRef}
          className="mx-auto mt-2 w-full max-w-[1400px] rounded-lg border border-border bg-background/95 shadow-[0_8px_40px_-20px_rgba(29,29,31,0.35)] backdrop-blur-xl lg:hidden"
        >
          <nav className="flex flex-col gap-1 p-3" aria-label="Navigasi seluler">
            {leftItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-3 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {item.label}
              </a>
            ))}
            <p className="px-3.5 pb-1 pt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Products
            </p>
            {productItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-3 text-sm text-foreground hover:bg-secondary"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 flex gap-2 border-t border-border pt-4">
              {authed ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
