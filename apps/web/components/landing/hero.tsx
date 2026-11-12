'use client'

import Link from 'next/link'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import { Device3D } from './device-3d'

const feedback = [
  { label: 'Pronunciation', value: 86 },
  { label: 'Fluency', value: 78 },
  { label: 'Grammar', value: 82 },
]

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.fromTo(
          '[data-hero-line]',
          { opacity: 0, y: 34 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
        )
          .fromTo('[data-hero-sub]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.5')
          .fromTo('[data-hero-cta]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55 }, '-=0.4')
      })
      return () => mm.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden bg-background lg:min-h-[calc(100dvh-4.5rem)]"
    >
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pt-14">
        <div className="max-w-2xl">
          <h1 className="font-display text-[2.6rem] font-medium leading-[1.04] tracking-[-0.03em] text-foreground text-balance sm:text-6xl lg:text-[4.25rem]">
            <span data-hero-line className="block">
              Bicara Inggris
            </span>
            <span data-hero-line className="block">
              tanpa <em className="italic text-primary">rasa malu</em>.
            </span>
          </h1>

          <p
            data-hero-sub
            className="mt-6 max-w-[46ch] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg"
          >
            Partner AI yang sabar, feedback lima dimensi, dan tantangan harian untuk siswa SMA/SMK.
          </p>

          <div data-hero-cta className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/sign-up"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Mulai Latihan Gratis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#fitur"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Lihat Fitur
            </Link>
          </div>
        </div>

        <div className="w-full">
          <Device3D />

          <div className="mx-auto mt-6 max-w-md rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Contoh feedback
              </p>
              <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                5 dimensi
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {feedback.map((r) => (
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
              &ldquo;Good job! Coba pelafalan <span className="font-semibold text-foreground">th</span> di
              &lsquo;think&rsquo;, ya.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
