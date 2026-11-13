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
  { node: <SiNextdotjs />, title: 'Next.js', hoverColor: '#101014' },
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
      data-nav-theme="light"
      className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden bg-background"
    >
      {/* Full-viewport background illustration, sitting behind the transparent navbar */}
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

      {/* Soft dark veil behind the copy keeps the white headline legible on the sky */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_64%_54%_at_50%_44%,rgba(9,22,42,0.58),rgba(9,22,42,0.3)_58%,transparent_80%)]"
        aria-hidden
      />

      {/* Top scrim keeps the transparent navbar legible over the sky */}
      <div
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink-deep/55 to-transparent"
        aria-hidden
      />

      {/* White gradient transition into the next section */}
      <div
        className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-background/85 to-background sm:h-64"
        aria-hidden
      />

      {/* Centered headline, subheadline and CTAs */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pt-24 text-center sm:px-6">
        <h1 className="font-display text-[2.6rem] font-medium leading-[1.04] tracking-[-0.02em] text-balance text-white sm:text-6xl lg:text-[4.25rem]">
          <span data-hero-line className="block text-white">
            Berani Berbicara
          </span>
          <span data-hero-line className="block">
            Tumbuh <em className="italic text-accent-glow">Percaya Diri</em>
          </span>
        </h1>

        <p
          data-hero-sub
          className="mt-6 max-w-[52ch] text-base leading-relaxed text-white/85 text-pretty sm:text-lg"
        >
          Partner latihan speaking berbasis AI untuk siswa SMA/SMK — umpan balik personal,
          progres terukur.
        </p>

        <div data-hero-cta className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/auth/sign-up"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-ink-deep shadow-lg shadow-ink-deep/25 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            Mulai Sekarang
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          <Link
            href="mailto:hello@tuturai.id"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/45 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/20"
          >
            Hubungi Kami
          </Link>
        </div>
      </div>

      {/* Technology logo marquee */}
      <div
        data-hero-marquee
        className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-14 sm:px-6 sm:pb-16"
      >
        <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/70">
          Dibangun dengan teknologi
        </p>
        <LogoLoop
          logos={stackLogos}
          speed={80}
          logoHeight={26}
          gap={48}
          ariaLabel="Teknologi di balik TuturAI"
          className="text-foreground/60"
        />
      </div>
    </section>
  )
}
