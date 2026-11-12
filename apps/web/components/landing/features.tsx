'use client'

import Image from 'next/image'
import { Mic, WifiOff, BarChart3, Flame } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const dimensions = [
  { label: 'Pronunciation', value: 86 },
  { label: 'Fluency', value: 78 },
  { label: 'Intonation', value: 74 },
  { label: 'Grammar', value: 82 },
  { label: 'Vocabulary', value: 80 },
]

const queue = [
  { label: 'Speaking · Describe your dream job', state: 'Tersimpan' },
  { label: 'Quiz · Past tense', state: 'Tersimpan' },
  { label: 'Listening · Unit 4', state: 'Menunggu' },
]

const streak = [true, true, true, true, true, false, false]

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-24 bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <GSAPLines>
            <h2 className="font-display text-3xl font-medium leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Semua alat bicara,
              </span>
              <span data-line className="block">
                dalam satu tempat.
              </span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 text-muted-foreground text-pretty">
              Dari partner latihan sampai analitik kelas, dirancang untuk konteks sekolah Indonesia.
            </p>
          </GSAPReveal>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-6">
          {/* Photo cell — the largest surface on the page */}
          <GSAPReveal className="md:col-span-4 md:row-span-2">
            <article className="relative h-full min-h-[340px] overflow-hidden rounded-sm border border-border">
              <Image
                src="/hero-student.webp"
                alt="Siswa SMA berlatih speaking dengan partner AI TuturAI"
                fill
                sizes="(min-width: 768px) 66vw, 100vw"
                className="object-cover object-top"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-linear-to-t from-ink-deep/92 via-ink-deep/45 to-ink-deep/5"
              />
              <div className="relative flex h-full flex-col justify-end p-7 sm:p-9">
                <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/85">
                  <Mic className="h-3.5 w-3.5" />
                  Partner speaking
                </span>
                <h3 className="mt-4 font-display text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                  Ngobrol bebas, kapan pun
                </h3>
                <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-white/75 text-pretty">
                  Skenario sehari-hari dan materi sekolah. Suara AI bisa memakai suara guru sendiri.
                </p>

                {/* Live waveform — the mini-UI that proves the session is real */}
                <div className="mt-6 flex items-end gap-1" aria-hidden>
                  {[38, 62, 48, 84, 58, 92, 44, 70, 52, 88, 40, 66, 50, 78].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-lg bg-primary"
                      style={{ height: `${h * 0.36}px` }}
                    />
                  ))}
                </div>
              </div>
            </article>
          </GSAPReveal>

          {/* Solid primary — real chart bars */}
          <GSAPReveal delay={0.06} className="md:col-span-2">
            <article className="flex h-full flex-col rounded-sm bg-primary p-7 text-primary-foreground">
              <h3 className="font-display text-xl font-medium tracking-[-0.01em]">Feedback 5 dimensi</h3>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80 text-pretty">
                Skor keluar langsung setelah kamu selesai bicara.
              </p>
              <dl className="mt-6 space-y-2.5">
                {dimensions.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <dt className="w-24 shrink-0 text-[11px] text-primary-foreground/80">{d.label}</dt>
                    <dd className="flex flex-1 items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-lg bg-white/20">
                        <span
                          className="block h-full rounded-lg bg-white"
                          style={{ width: `${d.value}%` }}
                        />
                      </span>
                      <span className="w-6 font-mono text-[11px] font-semibold">{d.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </GSAPReveal>

          {/* Solid dark — offline queue mini-UI */}
          <GSAPReveal delay={0.1} className="md:col-span-2">
            <article className="flex h-full flex-col rounded-sm bg-ink-deep p-7 text-background">
              <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-background/80">
                <WifiOff className="h-3.5 w-3.5" />
                Offline-first
              </span>
              <h3 className="mt-4 font-display text-xl font-medium tracking-[-0.01em]">
                Latihan tetap jalan tanpa internet
              </h3>
              <ul className="mt-5 space-y-2">
                {queue.map((q) => (
                  <li
                    key={q.label}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
                  >
                    <span className="truncate text-[11px] text-background/80">{q.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-background/55">{q.state}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-[11px] text-background/55">
                Sinkron otomatis saat kembali online
              </p>
            </article>
          </GSAPReveal>

          {/* Card with a real dashboard crop */}
          <GSAPReveal delay={0.04} className="md:col-span-3">
            <article className="flex h-full flex-col overflow-hidden rounded-sm border border-border bg-card">
              <div className="relative aspect-video overflow-hidden bg-secondary">
                <Image
                  src="/teacher-dashboard.webp"
                  alt="Guru melihat dashboard analitik kelas di laptop"
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="flex flex-1 flex-col p-7">
                <span className="inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Untuk guru
                </span>
                <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em] text-foreground">
                  Dashboard analitik kelas
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  Tren kemampuan, kesalahan yang paling sering muncul, dan siswa yang perlu didampingi.
                </p>
              </div>
            </article>
          </GSAPReveal>

          {/* Tinted card — streak mini-UI */}
          <GSAPReveal delay={0.08} className="md:col-span-3">
            <article className="flex h-full flex-col rounded-sm border border-border bg-secondary p-7">
              <span className="inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Flame className="h-3.5 w-3.5" />
                Progres
              </span>
              <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em] text-foreground">
                XP, streak, dan badge
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                Setiap sesi menambah XP. Jaga streak harian dan naik di leaderboard kelas.
              </p>

              <div className="mt-6 flex flex-1 flex-col justify-center rounded-sm border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Minggu ini
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-foreground">5 / 7 hari</span>
                </div>
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {streak.map((on, i) => (
                    <span
                      key={i}
                      className={`h-8 flex-1 rounded-lg ${on ? 'bg-primary' : 'bg-secondary'}`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">Level 12</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-lg bg-secondary">
                    <span className="block h-full w-[68%] rounded-lg bg-primary" />
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-foreground">850 XP</span>
                </div>
              </div>
            </article>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
