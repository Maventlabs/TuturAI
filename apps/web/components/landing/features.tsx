'use client'

import Image from 'next/image'
import { Mic, Gauge, Trophy, WifiOff, BarChart3 } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-20 bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <GSAPLines>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <span data-line className="block">Semua alat bicara,</span>
              <span data-line className="block">dalam satu tempat.</span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-4 text-muted-foreground">
              Mulai dari partner AI sampai analitik guru — dirancang untuk konteks belajar Indonesia.
            </p>
          </GSAPReveal>
        </div>

        {/* Bento 5 sel: 2 besar + 3 kecil — ritme ber-variasi, background beragam */}
        <div className="mt-12 grid gap-5 md:grid-cols-6">
          {/* Hero cell: partner speaking + image */}
          <GSAPReveal className="md:col-span-4">
            <article className="group relative h-full overflow-hidden rounded-[1.75rem] border border-border bg-card">
              <div className="grid sm:grid-cols-2">
                <div className="p-7 sm:p-9">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Mic className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-heading text-xl font-bold text-foreground">Partner Speaking AI</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Ngobrol bebas 24/7. Tidak malu, tidak dinilai teman — latihan sampai berani.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Skenario sehari-hari & materi sekolah</li>
                    <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Suara AI bisa pakai suara guru</li>
                  </ul>
                </div>
                <div className="relative min-h-56 overflow-hidden bg-secondary">
                  <Image
                    src="/hero-student.webp"
                    alt="Siswa berlatih speaking dengan partner AI TuturAI"
                    width={640}
                    height={520}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
              </div>
            </article>
          </GSAPReveal>

          {/* 5 dimensi */}
          <GSAPReveal delay={0.07} className="md:col-span-2">
            <article className="h-full rounded-[1.75rem] bg-primary p-7 text-primary-foreground">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                <Gauge className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-xl font-bold">Feedback 5 Dimensi</h3>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
                Pronunciation, fluency, intonation, grammar, vocabulary — langsung setelah bicara.
              </p>
              <div className="mt-6 space-y-2">
                {['Pronunciation', 'Fluency', 'Intonation', 'Grammar', 'Vocabulary'].map((d) => (
                  <span key={d} className="inline-block rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
                    {d}
                  </span>
                ))}
              </div>
            </article>
          </GSAPReveal>

          {/* Gamifikasi */}
          <GSAPReveal delay={0.03} className="md:col-span-2">
            <article className="h-full rounded-[1.75rem] border border-border bg-brand/15 p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/25 text-brand-foreground">
                <Trophy className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-xl font-bold text-foreground">XP, Streak & Badge</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Kumpulkan XP, jaga streak, naik leaderboard kelas.
              </p>
            </article>
          </GSAPReveal>

          {/* Guru */}
          <GSAPReveal delay={0.08} className="md:col-span-2">
            <article className="group relative h-full overflow-hidden rounded-[1.75rem] border border-border bg-card">
              <div className="p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-heading text-xl font-bold text-foreground">Dashboard Guru</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Tren, skill, common-error — putuskan perbaikan dari data.
                </p>
              </div>
            </article>
          </GSAPReveal>

          {/* Offline */}
          <GSAPReveal delay={0.12} className="md:col-span-2">
            <article className="h-full rounded-[1.75rem] bg-foreground p-7 text-background">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <WifiOff className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-xl font-bold">Offline-First</h3>
              <p className="mt-2 text-sm leading-relaxed text-background/70">
                Tanpa internet pun tetap latihan. Sync otomatis saat online.
              </p>
              <p className="mt-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold">PWA + perangkat ESP32-S3</p>
            </article>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
