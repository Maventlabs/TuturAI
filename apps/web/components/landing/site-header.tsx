'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Menu, X, ChevronDown, ArrowUpRight } from 'lucide-react'
import { Logo } from '@/components/logo'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

const leftItems = [
  { label: 'Features', href: '#fitur' },
  { label: 'Why TuturAI', href: '#masalah' },
]

const productItems = [
  { label: 'Untuk Siswa', href: '#untuk-siapa', desc: 'Ruang aman untuk bicara' },
  { label: 'Untuk Guru', href: '#untuk-siapa', desc: 'Dashboard analitik kelas' },
  { label: 'Perangkat Offline', href: '#offline', desc: 'ESP32-S3 handheld' },
  { label: 'Cara Kerja', href: '#cara-kerja', desc: 'Tiga langkah mulai' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [authed, setAuthed] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), (user) => setAuthed(Boolean(user)))
    } catch {
      setAuthed(false)
    }
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out' })
      let lastY = window.scrollY
      const onScroll = () => {
        const y = window.scrollY
        const dir = y > lastY ? 1 : -1
        lastY = y
        if (y > 340 && dir === 1) gsap.to(el, { y: -88, duration: 0.35, ease: 'power2.out', overwrite: 'auto' })
        else gsap.to(el, { y: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' })
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }, headerRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer || !open) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(drawer, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' })
  }, [open])

  return (
    <div className="fixed inset-x-0 top-3 z-50 px-3 sm:px-4">
      <header
        ref={headerRef}
        className="relative mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 rounded-lg border border-border/80 bg-background/90 px-4 shadow-[0_8px_40px_-16px_rgba(29,29,31,0.25)] backdrop-blur-xl"
      >
        {/* Left nav (desktop) */}
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
            <div className="invisible absolute left-0 top-full z-50 mt-1 w-64 translate-y-1 rounded-lg border border-border bg-card p-2 opacity-0 shadow-[0_16px_48px_-16px_rgba(29,29,31,0.3)] transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {productItems.map((item) => (
                <a key={item.label} href={item.href} className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary">
                  <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.desc}</span>
                </a>
              ))}
            </div>
          </div>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Center logo — absolute center, independent of left/right width */}
        <Link href="/" aria-label="TuturAI beranda" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Logo />
        </Link>

        {/* Right auth (desktop) */}
        <div className="ml-auto hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex">
          {authed ? (
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Dashboard
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                Login
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign Up
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
        <span className="w-10 shrink-0 lg:hidden" aria-hidden />
      </header>

      {open && (
        <div
          ref={drawerRef}
          className="mx-auto mt-2 w-full max-w-[1400px] rounded-lg border border-border bg-background/95 shadow-[0_8px_40px_-16px_rgba(29,29,31,0.25)] backdrop-blur-xl lg:hidden"
        >
          <nav className="flex flex-col gap-1 p-3" aria-label="Navigasi seluler">
            {leftItems.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3.5 py-3 text-sm font-medium text-foreground hover:bg-secondary">
                {item.label}
              </a>
            ))}
            <p className="px-3.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Products</p>
            {productItems.map((item) => (
              <a key={item.label} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3.5 py-3 text-sm text-foreground hover:bg-secondary">
                {item.label}
              </a>
            ))}
            <div className="mt-3 flex gap-2 border-t border-border pt-4">
              {authed ? (
                <Link href="/dashboard" onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/login" onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold">
                    Login
                  </Link>
                  <Link href="/auth/sign-up" onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
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
