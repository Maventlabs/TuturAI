'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight } from 'lucide-react'
import { Device3D } from './device-3d'

gsap.registerPlugin(ScrollTrigger)

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !sectionRef.current) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.fromTo(
        '[data-hero-line]',
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.75, stagger: 0.09 },
      )
        .fromTo('[data-hero-sub]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.45')
        .fromTo('[data-hero-cta]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55 }, '-=0.35')
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background">
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 px-4 pb-10 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:pt-32">
        {/* Text — left */}
        <div className="max-w-2xl">
          <h1 className="font-heading text-[2.75rem] leading-[1.02] font-extrabold tracking-tighter text-foreground sm:text-6xl lg:text-[4rem]">
            <span data-hero-line className="block">Bicara Inggris</span>
            <span data-hero-line className="block">
              tanpa{' '}
              <em className="font-extrabold not-italic underline decoration-primary/30 decoration-[0.08em] underline-offset-8">rasa malu</em>.
            </span>
          </h1>

          <p data-hero-sub className="mt-5 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            Partner AI yang sabar, feedback 5 dimensi, dan tantangan harian.
          </p>

          <div data-hero-cta className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/sign-up"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Mulai Latihan Gratis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#cara-kerja"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Lihat Cara Kerja
            </Link>
          </div>
        </div>

        {/* Visual — 3D device right */}
        <div className="w-full">
          <Device3D />
          <div className="mx-auto mt-6 max-w-md rounded-lg border border-border bg-card p-4 shadow-[0_16px_48px_-16px_rgba(29,29,31,0.3)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Feedback instan</p>
              <span className="rounded-lg bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">5 dimensi</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Pronunciation', value: 86 },
                { label: 'Fluency', value: 78 },
                { label: 'Grammar', value: 82 },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-muted-foreground">{r.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-lg bg-secondary">
                    <div className="h-full rounded-lg bg-primary" style={{ width: `${r.value}%` }} />
                  </div>
                  <span className="font-mono text-xs font-bold text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              &ldquo;Good job! Coba pelafalan <span className="font-semibold text-foreground">th</span> di &lsquo;think&rsquo;, ya.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
