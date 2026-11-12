'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import {
  SiEspressif,
  SiFirebase,
  SiGooglegemini,
  SiGooglecloud,
  SiNextdotjs,
  SiReact,
  SiTailwindcss,
  SiTypescript,
} from 'react-icons/si'
import LogoLoop from '@/components/ui/logo-loop'

const stackLogos = [
  { node: <SiNextdotjs />, title: 'Next.js', hoverColor: '#ffffff' },
  { node: <SiTypescript />, title: 'TypeScript', hoverColor: '#3178c6' },
  { node: <SiReact />, title: 'React', hoverColor: '#61dafb' },
  { node: <SiTailwindcss />, title: 'Tailwind CSS', hoverColor: '#38bdf8' },
  { node: <SiFirebase />, title: 'Firebase', hoverColor: '#ffca28' },
  { node: <SiGooglegemini />, title: 'Gemini', hoverColor: '#8e75ff' },
  { node: <SiGooglecloud />, title: 'Google Cloud', hoverColor: '#4285f4' },
  { node: <SiEspressif />, title: 'ESP32', hoverColor: '#ff5a4f' },
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
          .fromTo('[data-hero-marquee]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
      })
      return () => mm.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      id="hero"
      data-nav-theme="blue"
      className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden bg-ink-deep"
    >
      {/* Full-viewport background illustration */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/landing/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Top scrim keeps the transparent navbar legible over the sky */}
      <div
        className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink-deep/45 via-ink-deep/15 to-transparent"
        aria-hidden
      />

      {/* White gradient transition into the next section */}
      <div
        className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent via-background/60 to-background sm:h-44"
        aria-hidden
      />

      {/* Centered headline, subheadline and CTAs */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pt-16 text-center sm:px-6">
        <h1 className="font-display text-[2.6rem] font-medium leading-[1.05] tracking-[-0.03em] text-balance drop-shadow-[0_2px_16px_rgba(16,20,40,0.35)] sm:text-6xl lg:text-[4.25rem]">
          <span data-hero-line className="block text-white/70">
            Bicara Bahasa Inggris,
          </span>
          <span data-hero-line className="block text-white">
            tanpa <em className="italic">takut salah</em>.
          </span>
        </h1>

        <p
          data-hero-sub
          className="mt-6 max-w-[52ch] text-base leading-relaxed text-white/85 text-pretty drop-shadow-[0_1px_10px_rgba(16,20,40,0.4)] sm:text-lg"
        >
          TuturAI adalah partner latihan speaking berbasis AI untuk siswa SMA/SMK — penilaian lima dimensi,
          umpan balik personal, dan progres yang terukur.
        </p>

        <div data-hero-cta className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/auth/sign-up"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary-foreground px-7 text-base font-semibold text-primary shadow-lg shadow-ink-deep/25 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            Mulai Sekarang
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          <Link
            href="mailto:hello@tuturai.id"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-white/35 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/20"
          >
            Hubungi Kami
          </Link>
        </div>
      </div>

      {/* Technology logo marquee */}
      <div
        data-hero-marquee
        className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-40 sm:px-6 sm:pb-48"
      >
        <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-white/65">
          Dibangun dengan teknologi
        </p>
        <LogoLoop
          logos={stackLogos}
          speed={80}
          logoHeight={26}
          gap={48}
          ariaLabel="Teknologi di balik TuturAI"
          className="text-white/85 drop-shadow-[0_1px_8px_rgba(16,20,40,0.35)]"
        />
      </div>
    </section>
  )
}
