'use client'

import Link from 'next/link'
import { WifiOff, Cpu, Battery, HardDrive, ArrowRight } from 'lucide-react'
import { DeviceConsole } from './device-console'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const specs = [
  {
    icon: WifiOff,
    t: 'Offline-first',
    d: 'Speaking, reading, dan kuis dasar tetap jalan tanpa internet.',
    v: 'PWA + antrean microSD',
  },
  {
    icon: Cpu,
    t: 'Edge AI',
    d: 'DS-CNN INT8 berjalan di ESP32-S3 untuk deteksi bicara dan fluency.',
    v: 'INT8 · TFLite Micro',
  },
  {
    icon: Battery,
    t: 'Baterai 4,5+ jam',
    d: 'Cukup untuk satu sesi kelas penuh tanpa mengecas.',
    v: 'LiPo 5000 mAh',
  },
  {
    icon: HardDrive,
    t: 'Antrean lokal',
    d: 'Rekaman disimpan di perangkat, jadi tidak ada data yang hilang.',
    v: 'MicroSD + HTTPS',
  },
]

export function OfflineHardware() {
  return (
    <section
      id="offline"
      data-nav-theme="dark"
      className="scroll-mt-24 bg-ink-deep px-4 py-20 text-background sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <GSAPLines>
            <h2 className="font-display text-3xl font-medium leading-[1.08] tracking-[-0.02em] text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Tanpa internet.
              </span>
              <span data-line className="block">
                Tanpa ponsel pribadi.
              </span>
            </h2>
          </GSAPLines>

          <GSAPReveal delay={0.1}>
            <p className="mt-6 max-w-[52ch] leading-relaxed text-background/60 text-pretty">
              Konsol genggam ESP32-S3 dengan layar TFT, mikrofon, dan speaker. Siswa berlatih mandiri
              di kelas, termasuk sekolah di wilayah 3T.
            </p>
          </GSAPReveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {specs.map((s, i) => (
              <GSAPReveal key={s.t} delay={i * 0.05}>
                <article className="h-full rounded-lg border border-white/10 bg-white/5 p-5">
                  <s.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-display text-lg font-medium tracking-[-0.01em]">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-background/60 text-pretty">{s.d}</p>
                  <p className="mt-3 inline-block rounded-lg bg-white/10 px-2.5 py-1 font-mono text-[11px]">
                    {s.v}
                  </p>
                </article>
              </GSAPReveal>
            ))}
          </div>

          <GSAPReveal delay={0.12}>
            <Link
              href="/auth/sign-up"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-lg bg-background px-6 text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Mulai Latihan Gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </GSAPReveal>
        </div>

        <GSAPReveal className="self-center">
          <div className="mx-auto w-full max-w-xl">
            <p className="mb-5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-background/50">
              Konsol genggam TuturAI · ESP32-S3
            </p>
            <DeviceConsole />
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { k: 'Layar', v: 'TFT 3,5"' },
                { k: 'Mikrofon', v: 'INMP441' },
                { k: 'Speaker', v: '2 W' },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-background/50">
                    {s.k}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </GSAPReveal>
      </div>
    </section>
  )
}
