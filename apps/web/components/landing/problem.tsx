'use client'

import { GSAPLines, GSAPReveal } from './gsap-helpers'
import {
  AnxietyIllustration,
  CrowdedIllustration,
  MuteIllustration,
  OfflineIllustration,
} from './problem-illustrations'

const cards = [
  {
    id: 'mute',
    title: 'Mute English',
    desc: 'Paham pasif, tapi diam saat harus bicara. Salah sedikit langsung terasa seperti gagal.',
    Illustration: MuteIllustration,
  },
  {
    id: 'anxiety',
    title: 'Speaking anxiety',
    desc: 'Foreign Language Speaking Anxiety membuat siswa menghindari partisipasi aktif di kelas.',
    Illustration: AnxietyIllustration,
  },
  {
    id: 'padat',
    title: 'Kelas padat',
    desc: 'Satu guru untuk 35 siswa. Latihan bicara satu per satu tidak pernah sempat.',
    Illustration: CrowdedIllustration,
  },
  {
    id: 'offline',
    title: 'Offline masih sulit',
    desc: 'Solusi yang bergantung penuh pada internet tidak sampai ke sekolah di wilayah 3T.',
    Illustration: OfflineIllustration,
  },
]

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

        <div className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {cards.map((card, index) => (
            <GSAPReveal key={card.id} delay={index * 0.06} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-sm border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
                <div className="flex h-[220px] items-center justify-center border-b border-border bg-secondary p-5">
                  <div className="h-full w-full max-w-[280px] transition-transform duration-500 group-hover:scale-[1.04]">
                    <card.Illustration />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-heading text-lg font-bold tracking-[-0.01em] text-foreground">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {card.desc}
                  </p>
                </div>
              </article>
            </GSAPReveal>
          ))}
        </div>

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
