'use client'

import { GSAPLines, GSAPReveal } from './gsap-helpers'

const rows = [
  {
    n: '01',
    title: 'Mute English',
    desc: 'Paham pasif, tapi diam saat harus bicara. Salah sedikit langsung terasa seperti gagal.',
  },
  {
    n: '02',
    title: 'Speaking anxiety',
    desc: 'Foreign Language Speaking Anxiety membuat siswa menghindari partisipasi aktif di kelas.',
  },
  {
    n: '03',
    title: 'Kelas padat',
    desc: 'Satu guru untuk 35 siswa. Latihan bicara satu per satu tidak pernah sempat.',
  },
  {
    n: '04',
    title: 'Offline masih sulit',
    desc: 'Solusi yang bergantung penuh pada internet tidak sampai ke sekolah di wilayah 3T.',
  },
]

const proof = [
  { v: '110,0 → 83,6', l: 'Skor FLSA turun' },
  { v: '+15 poin', l: 'Kemampuan speaking' },
  { v: '80,0', l: 'SUS, kategori acceptable' },
]

export function Problem() {
  return (
    <section id="masalah" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <GSAPLines>
            <h2 className="font-display text-3xl font-medium leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Bukan karena grammar.
              </span>
              <span data-line className="block">
                Karena <em className="italic text-primary">takut</em>.
              </span>
            </h2>
          </GSAPLines>

          <GSAPReveal delay={0.1}>
            <p className="mt-6 max-w-[48ch] leading-relaxed text-muted-foreground text-pretty">
              Siswa Indonesia memahami bahasa Inggris secara pasif, lalu lumpuh saat diminta praktik.
              TuturAI memberi ruang latihan yang aman, tanpa takut ditertawakan teman sekelas.
            </p>
          </GSAPReveal>

          <GSAPReveal delay={0.18}>
            <dl className="mt-9 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
              {proof.map((s) => (
                <div key={s.l} className="px-3 py-4 text-center">
                  <dt className="sr-only">{s.l}</dt>
                  <dd>
                    <span className="block font-mono text-sm font-semibold text-foreground sm:text-base">
                      {s.v}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{s.l}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Angka hasil uji terbatas pada siswa SMA/SMK, riset LIDM 2026. Bukan klaim skala nasional.
            </p>
          </GSAPReveal>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {rows.map((r, i) => (
            <GSAPReveal key={r.n} delay={i * 0.06} className="flex items-start gap-6 py-7">
              <span className="pt-0.5 font-mono text-sm font-semibold text-primary">{r.n}</span>
              <div className="flex-1">
                <h3 className="font-display text-xl font-medium tracking-[-0.01em] text-foreground">
                  {r.title}
                </h3>
                <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                  {r.desc}
                </p>
              </div>
            </GSAPReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
