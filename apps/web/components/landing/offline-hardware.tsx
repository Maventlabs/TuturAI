'use client'

import Link from 'next/link'
import { WifiOff, Cpu, Battery, HardDrive, ArrowRight } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const specs = [
  { icon: WifiOff, t: 'Offline-First', d: 'Speaking, reading, kuis dasar tanpa internet. Sync saat online.', v: 'PWA + microSD queue' },
  { icon: Cpu, t: 'Edge AI', d: 'DS-CNN INT8 di ESP32-S3. VAD + MFCC + fluency tanpa cloud.', v: 'INT8 • TFLite Micro' },
  { icon: Battery, t: 'Baterai 4.5+ jam', d: 'LiPo 3.7V 5000mAh untuk satu sesi kelas penuh.', v: 'LiPo 5000mAh' },
  { icon: HardDrive, t: 'Antrean lokal', d: 'Rekaman di microSD. Tidak ada data hilang saat putus koneksi.', v: 'MicroSD + HTTPS' },
]

export function OfflineHardware() {
  return (
    <section id="offline" className="scroll-mt-20 bg-[#101014] px-4 py-20 text-[#f5f5f7] sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px] grid gap-14 lg:grid-cols-2 lg:gap-20">
        {/* Copy + specs */}
        <div>
          <GSAPLines>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              <span data-line className="block">Tanpa internet.</span>
              <span data-line className="block">Tanpa ponsel.</span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 max-w-[52ch] leading-relaxed text-[#a1a1a8]">
              Konsol genggam ESP32-S3 berlayar TFT, mikrofon, dan speaker. Siswa berlatih mandiri —
              cocok untuk sekolah di wilayah 3T.
            </p>
          </GSAPReveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {specs.map((s, i) => (
              <GSAPReveal key={s.t} delay={i * 0.05}>
                <article className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
                  <s.icon className="h-5 w-5 text-[#5b8cff]" />
                  <h3 className="mt-3 font-heading text-base font-bold">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#a1a1a8]">{s.d}</p>
                  <p className="mt-3 inline-block rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] font-semibold">{s.v}</p>
                </article>
              </GSAPReveal>
            ))}
          </div>

          <GSAPReveal delay={0.12}>
            <Link
              href="/auth/sign-up"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#f5f5f7] px-6 text-sm font-semibold text-[#101014] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Pelajari Lebih Lanjut <ArrowRight className="h-4 w-4" />
            </Link>
          </GSAPReveal>
        </div>

        {/* Device visual — CSS console (Anatomy spirit: banyak bagian kecil presisi) */}
        <GSAPReveal className="self-center">
          <div className="relative mx-auto w-full max-w-md">
            <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#a1a1a8]">
              Konsol genggam TuturAI — ESP32-S3
            </p>

            <div className="relative rounded-[2.2rem] border border-white/15 bg-[#1c1c21] p-4 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.7)]">
              {/* dual-tone shell */}
              <div className="grid grid-cols-2 overflow-hidden rounded-[1.6rem]">
                <div className="relative bg-[#c62f2f] p-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/70">TuturAI</p>
                  {/* D-Pad */}
                  <div className="relative mt-8 h-16 w-16">
                    <div className="absolute left-1/2 top-0 h-6 w-6 -translate-x-1/2 rounded-md bg-[#101014]" />
                    <div className="absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 rounded-md bg-[#101014]" />
                    <div className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md bg-[#101014]" />
                    <div className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md bg-[#101014]" />
                    <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#101014]" />
                  </div>
                  {/* screws */}
                  <span aria-hidden className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/20" />
                  <span aria-hidden className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/20" />
                </div>
                <div className="relative bg-[#e0701c] p-4">
                  {/* action buttons */}
                  <div className="flex justify-end gap-1.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white">Y</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white">X</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-1.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white">B</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white">A</span>
                  </div>
                  {/* analog stick */}
                  <div className="relative mt-5 ml-auto h-14 w-14 rounded-full bg-black/25 ring-1 ring-black/30">
                    <div className="absolute inset-3 rounded-full bg-[#101014] shadow-inner" />
                  </div>
                  <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/20" />
                  <span aria-hidden className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/20" />
                </div>
              </div>

              {/* black bezel center + TFT */}
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 sm:inset-x-10">
                <div className="rounded-xl bg-black p-1.5 ring-1 ring-white/20">
                  <div className="overflow-hidden rounded-lg bg-[#0a1f3d]">
                    <div className="flex items-center justify-between px-3 py-2 font-mono text-[10px] text-[#5b8cff]">
                      <span>Speaking • Level 2</span>
                      <span>0:42</span>
                    </div>
                    <div className="px-3 pb-3">
                      <p className="text-sm font-bold text-white">Describe your dream job.</p>
                      <div className="mt-3 flex h-8 items-end gap-1" aria-hidden>
                        {[40, 70, 55, 90, 65, 80, 50, 95, 60, 75, 45, 85].map((h, i) => (
                          <span key={i} className="w-1.5 rounded-full bg-[#5b8cff]" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                      <p className="mt-2 font-mono text-[10px] text-[#a1a1a8]">Fluency 82 • Merekam…</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* LED strip */}
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-1.5 w-6 rounded-full ${i === 0 ? 'bg-[#3fbd7f]' : 'bg-white/15'}`} />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-[#a1a1a8]">INMP441 • MAX98357A</span>
              </div>

              {/* mic + speaker marks */}
              <div className="pointer-events-none absolute -left-1 top-1/2 flex -translate-y-1/2 flex-col gap-1" aria-hidden>
                <span className="h-1 w-3 rounded-full bg-white/30" />
                <span className="h-1 w-3 rounded-full bg-white/30" />
                <span className="h-1 w-3 rounded-full bg-white/30" />
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { k: 'Layar', v: 'TFT 3.5"' },
                { k: 'Mic', v: 'INMP441' },
                { k: 'Speaker', v: '2W' },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-[#a1a1a8]">{s.k}</dt>
                  <dd className="mt-1 text-sm font-bold">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </GSAPReveal>
      </div>
    </section>
  )
}
