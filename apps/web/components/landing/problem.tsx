'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Activity, Users, Volume2, WifiOff } from 'lucide-react'
import CountUp from '@/components/ui/count-up'
import { GSAPLines, GSAPReveal, GSAPStagger } from './gsap-helpers'
import { AnxietyMockup, CrowdedMockup, MuteMockup, OfflineMockup } from './problem-mockups'

const cards = [
  {
    id: 'mute',
    label: 'Pola bicara',
    title: 'Mute English',
    desc: 'Paham pasif, tapi diam saat harus bicara. Salah sedikit langsung terasa seperti gagal.',
    image: '/problem-mute.webp',
    tint: '#e23b2e',
    // The panels cover the lower two thirds, so each photo is zoomed and
    // shifted to put its subject inside the strip that stays visible.
    crop: 'scale(1.12) translateY(-3%)',
    Icon: Volume2,
    Mockup: MuteMockup,
  },
  {
    id: 'anxiety',
    label: 'Rasa aman',
    title: 'Speaking anxiety',
    desc: 'Foreign Language Speaking Anxiety membuat siswa menghindari partisipasi aktif di kelas.',
    image: '/problem-anxiety.webp',
    tint: '#e07a1f',
    crop: 'scale(1.12) translateY(-3%)',
    Icon: Activity,
    Mockup: AnxietyMockup,
  },
  {
    id: 'padat',
    label: 'Skala kelas',
    title: 'Kelas padat',
    desc: 'Satu guru untuk 35 siswa. Latihan bicara satu per satu tidak pernah sempat.',
    image: '/problem-crowded.webp',
    tint: '#d9a300',
    crop: 'scale(1.3) translateY(-9%)',
    Icon: Users,
    Mockup: CrowdedMockup,
  },
  {
    id: 'offline',
    label: 'Akses jaringan',
    title: 'Offline masih sulit',
    desc: 'Solusi yang bergantung penuh pada internet tidak sampai ke sekolah di wilayah 3T.',
    image: '/problem-offline.webp',
    tint: '#2f6df5',
    crop: 'scale(1.04)',
    Icon: WifiOff,
    Mockup: OfflineMockup,
  },
]

function trackSpotlight(event: React.PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

/**
 * The four mockups run ~70 looping CSS animations between them. Pausing them
 * while the grid is off-screen keeps the landing page cheap to scroll.
 */
function useMockPause() {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, paused }
}

type ProofPoint = {
  from: number
  to: number
  decimals?: number
  prefix?: string
  suffix?: string
  arrowFrom?: string
  l: string
}

const proof: ProofPoint[] = [
  { from: 110, to: 83.6, decimals: 1, arrowFrom: '110,0', l: 'Skor FLSA turun' },
  { from: 0, to: 15, prefix: '+', suffix: ' poin', l: 'Kemampuan speaking' },
  { from: 0, to: 80, decimals: 1, l: 'SUS, kategori acceptable' },
]

export function Problem() {
  const { ref: stageRef, paused } = useMockPause()

  return (
    <section
      id="masalah"
      data-nav-theme="light"
      aria-labelledby="masalah-heading"
      className="section-y scroll-mt-24 bg-background px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-2xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Kenapa siswa diam
            </p>
          </GSAPReveal>
          <GSAPLines>
            <h2
              id="masalah-heading"
              className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-foreground text-balance sm:text-4xl lg:text-5xl"
            >
              <span data-line className="block">
                Bukan karena grammar.
              </span>
              <span data-line className="block">
                Karena <span className="text-primary">takut</span>.
              </span>
            </h2>

            <p
              data-line
              className="mt-6 max-w-[58ch] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg"
            >
              Siswa Indonesia memahami bahasa Inggris secara pasif, lalu lumpuh saat diminta
              praktik. TuturAI memberi ruang latihan yang aman, tanpa takut ditertawakan teman
              sekelas.
            </p>
          </GSAPLines>
        </div>

        <GSAPReveal delay={0.15} className="mt-12 sm:mt-16">
          <div className="relative border border-border">
            <span
              aria-hidden
              className="absolute -left-1.5 -top-1.5 size-3 border-l border-t border-foreground/25"
            />
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 size-3 border-r border-t border-foreground/25"
            />
            <span
              aria-hidden
              className="absolute -bottom-1.5 -left-1.5 size-3 border-b border-l border-foreground/25"
            />
            <span
              aria-hidden
              className="absolute -bottom-1.5 -right-1.5 size-3 border-b border-r border-foreground/25"
            />

            <div className="overflow-hidden">
              <div
                ref={stageRef}
                data-paused={paused}
                className="mock-stage -mb-px -mr-px grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
              >
                {cards.map((card) => (
                  <article
                    key={card.id}
                    className="group flex h-full flex-col border-b border-r border-border"
                  >
                    <div className="p-3 sm:p-4">
                      <div
                        onPointerMove={trackSpotlight}
                        className="relative aspect-4/5 overflow-hidden border border-border bg-ink-deep"
                      >
                        <div
                          aria-hidden
                          className="absolute inset-0"
                          style={{ transform: card.crop }}
                        >
                          <Image
                            src={card.image}
                            alt=""
                            fill
                            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                          />
                        </div>
                        {/* Colour grade keeps the four-card colour system without a flat gradient. */}
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-45 mix-blend-color"
                          style={{ backgroundColor: card.tint }}
                        />
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 bg-linear-to-b from-ink-deep/25 via-ink-deep/55 to-ink-deep/92"
                        />
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          style={{
                            background:
                              'radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.14), transparent 72%)',
                          }}
                        />
                        <div
                          aria-hidden
                          className="relative flex h-full flex-col justify-center p-3"
                        >
                          <card.Mockup />
                        </div>
                      </div>
                    </div>

                    <GSAPStagger
                      className="flex flex-1 flex-col px-4 pb-6 pt-4 sm:px-5"
                      y={10}
                      stagger={0.06}
                    >
                      <div data-stagger className="flex items-center gap-2">
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-[4px]"
                          style={{
                            backgroundColor: `${card.tint}1a`,
                            // The raw tints (especially amber) fall under 3:1 on the chip.
                            color: `color-mix(in oklab, ${card.tint} 70%, #1d1d1f)`,
                          }}
                        >
                          <card.Icon className="size-3.5" strokeWidth={1.75} />
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {card.label}
                        </span>
                      </div>
                      <h3
                        data-stagger
                        className="mt-3 font-heading text-xl font-semibold tracking-[-0.015em] text-foreground"
                      >
                        {card.title}
                      </h3>
                      <p
                        data-stagger
                        className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty"
                      >
                        {card.desc}
                      </p>
                    </GSAPStagger>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </GSAPReveal>

        <GSAPReveal delay={0.2} className="mt-10">
          <dl className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-border rounded-sm border border-border bg-card">
            {proof.map((s) => (
              <div key={s.l} className="px-3 py-4 text-center">
                <dt className="sr-only">{s.l}</dt>
                <dd>
                  <span className="block font-mono text-sm font-semibold text-foreground sm:text-base">
                    {s.arrowFrom ? (
                      <>
                        <span className="text-muted-foreground">{s.arrowFrom}</span>
                        <span aria-hidden="true" className="mx-1.5 text-muted-foreground">
                          →
                        </span>
                        <CountUp from={s.from} to={s.to} decimals={s.decimals} />
                      </>
                    ) : (
                      <CountUp
                        from={s.from}
                        to={s.to}
                        decimals={s.decimals}
                        prefix={s.prefix}
                        suffix={s.suffix}
                      />
                    )}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                    {s.l}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            Angka hasil uji terbatas pada siswa SMA/SMK, riset LIDM 2026. Bukan klaim skala
            nasional.
          </p>
        </GSAPReveal>
      </div>
    </section>
  )
}
