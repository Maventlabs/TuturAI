'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const studentPoints = [
  'Latihan tanpa takut salah atau ditertawakan',
  'Koreksi pelafalan dan grammar langsung setelah bicara',
  'Streak, XP, dan badge yang menjaga kebiasaan',
]

const teacherPoints = [
  'Progres tiap siswa terlihat tanpa mengoreksi satu per satu',
  'Siswa yang butuh pendampingan ditandai otomatis',
  'Beri tugas speaking, lalu pantau pengerjaannya',
]

const teacherStats = [
  { v: '5D', l: 'Diagnosis' },
  { v: 'Real-time', l: 'Progres' },
  { v: 'PDF', l: 'Laporan' },
]

const classAverage = [
  { label: 'Pronunciation', value: 74 },
  { label: 'Fluency', value: 68 },
  { label: 'Grammar', value: 71 },
]

export function Audience() {
  return (
    <section id="untuk-siapa" className="scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <GSAPLines>
            <h2 className="font-display text-3xl font-medium leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Satu platform,
              </span>
              <span data-line className="block">
                dua cara memakainya.
              </span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 text-muted-foreground text-pretty">
              Siswa dapat ruang aman untuk berlatih. Guru dapat data untuk mendampingi.
            </p>
          </GSAPReveal>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* Siswa — image-led, airy */}
          <GSAPReveal>
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src="/hero-student.webp"
                  alt="Siswa berlatih speaking dengan TuturAI di ponsel"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover object-top"
                />
                <span className="absolute left-4 top-4 rounded-lg bg-card/95 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground backdrop-blur">
                  Untuk siswa
                </span>
              </div>
              <div className="flex flex-1 flex-col p-7 sm:p-9">
                <h3 className="font-display text-2xl font-medium tracking-[-0.01em] text-foreground">
                  Berani bicara, satu sesi tiap hari
                </h3>
                <ul className="mt-5 flex-1 space-y-3">
                  {studentPoints.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/sign-up"
                  className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Mulai Latihan Gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </GSAPReveal>

          {/* Guru — dark, data-dense */}
          <GSAPReveal delay={0.08}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg bg-ink-deep text-background">
              <div className="border-b border-white/10 p-7 sm:p-9">
                <span className="rounded-lg bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-background/80">
                  Untuk guru
                </span>
                <h3 className="mt-4 font-display text-2xl font-medium tracking-[-0.01em]">
                  Pantau kelas tanpa mengoreksi satu per satu
                </h3>
              </div>

              <dl className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
                {teacherStats.map((s) => (
                  <div key={s.l} className="px-4 py-5 text-center">
                    <dt className="sr-only">{s.l}</dt>
                    <dd>
                      <span className="block font-mono text-base font-semibold">{s.v}</span>
                      <span className="mt-1 block text-[11px] text-background/55">{s.l}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-1 flex-col p-7 sm:p-9">
                <ul className="space-y-3">
                  {teacherPoints.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm leading-relaxed text-background/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-background" />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-background/50">
                    Rata-rata kelas
                  </p>
                  <div className="mt-3 space-y-2">
                    {classAverage.map((r) => (
                      <div key={r.label} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-[11px] text-background/60">{r.label}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-lg bg-white/10">
                          <span
                            className="block h-full rounded-lg bg-primary"
                            style={{ width: `${r.value}%` }}
                          />
                        </span>
                        <span className="w-6 font-mono text-[11px] font-semibold">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/auth/sign-up"
                  className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-background px-5 text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Daftarkan Kelas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
