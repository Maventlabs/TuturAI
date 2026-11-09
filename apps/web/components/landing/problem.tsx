'use client'

import { GSAPLines, GSAPReveal } from './gsap-helpers'

const rows = [
  {
    n: '01',
    title: 'Mute English',
    desc: 'Paham pasif, takut bicara. Salah dikit langsung berasa gagal.',
  },
  {
    n: '02',
    title: 'Speaking Anxiety',
    desc: 'FLSA bikin siswa menghindari partisipasi aktif di kelas.',
  },
  {
    n: '03',
    title: 'Kelas Padat',
    desc: '1 guru : 35 siswa. Feedback personal jadi tidak sempat.',
  },
  {
    n: '04',
    title: 'Offline Masih Sulit',
    desc: 'Solusi cloud-only tidak sampai ke sekolah 3T.',
  },
]

export function Problem() {
  return (
    <section id="masalah" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px] grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <GSAPLines>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <span data-line className="block">Bukan karena grammar.</span>
              <span data-line className="block">Karena takut.</span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 max-w-[48ch] leading-relaxed text-muted-foreground">
              Siswa Indonesia paham bahasa Inggris secara pasif, tapi lumpuh saat disuruh praktik.
              TuturAI memberi ruang latihan yang aman — tanpa ditertawakan.
            </p>
          </GSAPReveal>

          {/* Riset teaser — angka dari proposal LIDM, bukan fake metrics */}
          <GSAPReveal delay={0.18}>
            <div className="mt-8 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card">
              {[
                { v: '110,0 → 83,6', l: 'FLSA turun (riset)' },
                { v: '+15 poin', l: 'Speaking naik' },
                { v: '80,0', l: 'SUS (Acceptable)' },
              ].map((s) => (
                <div key={s.l} className="px-4 py-4 text-center">
                  <p className="font-heading text-sm font-extrabold text-foreground sm:text-base">{s.v}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Hasil uji pada siswa SMA/SMK — TuturAI LIDM 2026.</p>
          </GSAPReveal>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {rows.map((r, i) => (
            <GSAPReveal key={r.n} delay={i * 0.06} className="flex items-start gap-6 py-7">
              <span className="font-mono text-sm font-bold text-primary">{r.n}</span>
              <div className="flex-1">
                <h3 className="font-heading text-lg font-bold text-foreground">{r.title}</h3>
                <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            </GSAPReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
