'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const studentPoints = [
  'Latihan tanpa takut salah atau ditertawakan',
  'Feedback langsung untuk pelafalan & grammar',
  'Streak, XP, dan badge yang bikin semangat',
]

const teacherPoints = [
  'Dashboard progres tiap siswa secara real-time',
  'Deteksi siswa yang butuh perhatian khusus',
  'Beri tugas speaking dan pantau pengerjaannya',
]

export function Audience() {
  return (
    <section id="untuk-siapa" className="scroll-mt-20 overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <GSAPLines>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <span data-line className="block">Satu platform,</span>
              <span data-line className="block">dua pengalaman berbeda.</span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-4 text-muted-foreground">
              Siswa dapat ruang aman untuk bicara. Guru dapat data untuk mendampingi.
            </p>
          </GSAPReveal>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* Siswa — image top, list below (cerita siswa) */}
          <GSAPReveal>
            <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card">
              <div className="relative overflow-hidden">
                <Image
                  src="/hero-student.webp"
                  alt="Siswa berlatih speaking dengan TuturAI"
                  width={640}
                  height={520}
                  className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span className="absolute left-4 top-4 rounded-full bg-card/95 px-3 py-1 text-xs font-bold text-foreground backdrop-blur">
                  Untuk Siswa
                </span>
              </div>
              <div className="flex flex-1 flex-col p-7">
                <h3 className="font-heading text-xl font-bold text-foreground">Percaya diri bicara, satu sesi tiap hari</h3>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {studentPoints.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/sign-up"
                  className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Daftar sebagai Siswa <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </GSAPReveal>

          {/* Guru — stat strip instead of image (dashboard-centric) */}
          <GSAPReveal delay={0.08}>
            <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-foreground text-background">
              <div className="border-b border-white/10 p-7">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">Untuk Guru</span>
                <h3 className="mt-4 font-heading text-xl font-bold">Pantau kelas tanpa koreksi satu per satu</h3>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
                {[
                  { v: '5D', l: 'Diagnosis' },
                  { v: 'Real-time', l: 'Progres' },
                  { v: 'PDF', l: 'Laporan' },
                ].map((s) => (
                  <div key={s.l} className="p-4 text-center">
                    <p className="font-heading text-base font-extrabold">{s.v}</p>
                    <p className="mt-1 text-[11px] text-background/60">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-1 flex-col p-7">
                <ul className="flex-1 space-y-2.5">
                  {teacherPoints.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-background/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-background" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/sign-up"
                  className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-background px-5 text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Daftar sebagai Guru <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
