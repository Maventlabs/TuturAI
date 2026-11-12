'use client'

import Image from 'next/image'
import { Activity, Users, Volume2, WifiOff } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'
import { AnxietyMockup, CrowdedMockup, MuteMockup, OfflineMockup } from './problem-mockups'

const cards = [
  {
    id: 'mute',
    label: 'Pola bicara',
    title: 'Mute English',
    desc: 'Paham pasif, tapi diam saat harus bicara. Salah sedikit langsung terasa seperti gagal.',
    image: '/problem-red.png',
    Icon: Volume2,
    Mockup: MuteMockup,
  },
  {
    id: 'anxiety',
    label: 'Rasa aman',
    title: 'Speaking anxiety',
    desc: 'Foreign Language Speaking Anxiety membuat siswa menghindari partisipasi aktif di kelas.',
    image: '/problem-orange.png',
    Icon: Activity,
    Mockup: AnxietyMockup,
  },
  {
    id: 'padat',
    label: 'Skala kelas',
    title: 'Kelas padat',
    desc: 'Satu guru untuk 35 siswa. Latihan bicara satu per satu tidak pernah sempat.',
    image: '/problem-yellow.png',
    Icon: Users,
    Mockup: CrowdedMockup,
  },
  {
    id: 'offline',
    label: 'Akses jaringan',
    title: 'Offline masih sulit',
    desc: 'Solusi yang bergantung penuh pada internet tidak sampai ke sekolah di wilayah 3T.',
    image: '/problem-blue.png',
    Icon: WifiOff,
    Mockup: OfflineMockup,
  },
]

function trackSpotlight(event: React.PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

const proof = [
  { v: '110,0 → 83,6', l: 'Skor FLSA turun' },
  { v: '+15 poin', l: 'Kemampuan speaking' },
  { v: '80,0', l: 'SUS, kategori acceptable' },
]

export function Problem() {
  return (
    <section id="masalah" className="scroll-mt-24 bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-2xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Masalahnya
            </p>
          </GSAPReveal>
          <GSAPLines>
            <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Bukan karena grammar.
              </span>
              <span data-line className="block">
                Karena <span className="text-primary">takut</span>.
              </span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 text-muted-foreground text-pretty">
              Siswa Indonesia memahami bahasa Inggris secara pasif, lalu lumpuh saat diminta
              praktik. TuturAI memberi ruang latihan yang aman, tanpa takut ditertawakan teman
              sekelas.
            </p>
          </GSAPReveal>
        </div>

        <GSAPReveal delay={0.15} className="mt-12">
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
              <div className="-mb-px -mr-px grid auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
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
                        <Image
                          src={card.image}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          style={{
                            background:
                              'radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.16), transparent 72%)',
                          }}
                        />
                        <div className="relative flex h-full flex-col justify-center p-3">
                          <card.Mockup />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-4 pb-6 pt-1 sm:px-5">
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <card.Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                        {card.label}
                      </div>
                      <h3 className="mt-4 font-heading text-lg font-semibold tracking-[-0.01em] text-foreground">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                        {card.desc}
                      </p>
                    </div>
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
                    {s.v}
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
