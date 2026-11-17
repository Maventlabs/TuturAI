'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ViewPreset } from './device-scene'

const DeviceScene = dynamic(() => import('./device-scene').then((m) => m.DeviceScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      Memuat model 3D
    </div>
  ),
})

const features = [
  {
    image: '/landing/hardware-classroom.webp',
    title: 'Tetap jalan offline',
    body: 'Speaking, reading, dan kuis dasar tetap aktif tanpa sinyal, termasuk di sekolah wilayah 3T.',
    meta: 'PWA + antrean microSD',
  },
  {
    image: '/landing/hardware-chip.webp',
    title: 'AI di dalam perangkat',
    body: 'DS-CNN INT8 memproses suara langsung di ESP32-S3. Audio tidak dikirim ke cloud.',
    meta: 'INT8 · TFLite Micro',
  },
  {
    image: '/landing/hardware-desk.webp',
    title: 'Baterai satu sesi kelas',
    body: '4,5 jam pemakaian terus-menerus, cukup untuk satu blok pelajaran tanpa mengecas.',
    meta: 'LiPo 5000 mAh',
  },
]

const views: { id: ViewPreset; label: string }[] = [
  { id: 'isometri', label: 'Isometri' },
  { id: 'depan', label: 'Depan' },
  { id: 'belakang', label: 'Belakang' },
  { id: 'samping', label: 'Samping' },
]

const modes = ['Speaking', 'Reading', 'Kuis'] as const

const modeDescriptions: Record<(typeof modes)[number], string> = {
  Speaking: 'Latihan bicara tersimpan di perangkat hingga koneksi kembali.',
  Reading: 'Latihan membaca tersedia tanpa koneksi internet.',
  Kuis: 'Kuis dasar dapat dikerjakan langsung di konsol.',
}

const segmentBase =
  'min-h-10 rounded-sm px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const segmentActive = 'bg-primary text-primary-foreground'
const segmentIdle = 'bg-secondary text-foreground hover:bg-primary/12'

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 border-b border-border/70 py-3 text-left text-sm font-medium text-foreground last:border-0"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </span>
    </button>
  )
}

export function OfflineHardware() {
  const [preset, setPreset] = useState<ViewPreset>('isometri')
  const [exploded, setExploded] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [showTop, setShowTop] = useState(true)
  const [mode, setMode] = useState<(typeof modes)[number]>('Speaking')
  const [ready, setReady] = useState(false)
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setReady(true)
        observer.disconnect()
      },
      { rootMargin: '240px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="offline" data-nav-theme="light" className="section-y scroll-mt-24 bg-secondary px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Perangkat</p>
          <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-foreground text-balance sm:text-4xl lg:text-5xl">
            <span className="block">Tanpa internet.</span>
            <span className="block text-primary">Tanpa ponsel pribadi.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[58ch] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            Satu konsol untuk seluruh kelas. Penilaian dasar berjalan di perangkat, bukan di cloud.
          </p>
        </header>

        <div className="mt-10 grid gap-4 rounded-lg border border-border bg-card p-3 sm:mt-14 sm:p-4 lg:min-h-[720px] lg:grid-cols-[minmax(220px,0.78fr)_minmax(340px,1.35fr)_minmax(270px,0.9fr)] lg:gap-4 lg:p-5">
          <div className="order-2 grid gap-3 sm:grid-cols-3 lg:order-1 lg:grid-cols-1 lg:grid-rows-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group relative flex min-h-[210px] flex-col justify-end overflow-hidden rounded-md bg-ink-deep bg-cover bg-center p-5 text-white sm:min-h-[240px] lg:min-h-0"
                style={{ backgroundImage: `url('${feature.image}')` }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-deep via-ink-deep/85 to-ink-deep/15"
                />
                <h3 className="relative z-10 max-w-[18ch] font-heading text-lg font-semibold leading-snug tracking-[-0.02em] text-white sm:text-xl">
                  {feature.title}
                </h3>
                <p className="relative z-10 mt-2 text-[13px] leading-relaxed text-white/85">{feature.body}</p>
                <p className="relative z-10 mt-4 border-t border-white/25 pt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
                  {feature.meta}
                </p>
              </article>
            ))}
          </div>

          <figure className="device-showcase-figure relative order-1 min-h-[380px] overflow-hidden rounded-md border border-border bg-card lg:order-2 lg:min-h-0">
            <div ref={stage} className="absolute inset-0">
              {ready ? (
                <DeviceScene preset={preset} exploded={exploded} autoRotate={autoRotate} showTop={showTop} />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Model perangkat 3D
                </div>
              )}
            </div>
            <span className="pointer-events-none absolute left-4 top-4 rounded-sm border border-border bg-card/90 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-primary-deep backdrop-blur-sm">
              ESP32-S3 · TuturAI
            </span>
            <span className="pointer-events-none absolute right-4 top-4 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              Geser untuk memutar 360°
            </span>
            <figcaption className="pointer-events-none absolute inset-x-4 bottom-4 rounded-sm border border-border bg-card/90 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground backdrop-blur-md sm:inset-x-6 sm:bottom-6">
              Konsol belajar mandiri dengan layar TFT, mikrofon, dan speaker, dirancang untuk ruang kelas dengan koneksi terbatas.
            </figcaption>
          </figure>

          <aside className="order-3 flex flex-col gap-3 lg:pl-1">
            <div className="rounded-md border border-border bg-background p-4 sm:p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-muted-foreground">Konfigurasi visual</p>
              <h3 className="mt-1.5 font-heading text-base font-semibold text-foreground">Atur perangkat</h3>
              <div className="mt-3">
                <Toggle label="Urai komponen" checked={exploded} onChange={setExploded} />
                <Toggle label="Putar otomatis" checked={autoRotate} onChange={setAutoRotate} />
                <Toggle label="Tampilkan casing atas" checked={showTop} onChange={setShowTop} />
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Sudut pandang</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {views.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setPreset(view.id)}
                      aria-pressed={preset === view.id}
                      className={cn(segmentBase, preset === view.id ? segmentActive : segmentIdle)}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-4 sm:p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-muted-foreground">Mode offline</p>
              <h3 className="mt-1.5 font-heading text-base font-semibold text-foreground">Pilih aktivitas</h3>
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Pilih aktivitas perangkat">
                {modes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    aria-pressed={mode === item}
                    className={cn(segmentBase, 'px-2', mode === item ? segmentActive : segmentIdle)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p aria-live="polite" className="mt-3 min-h-10 text-xs leading-relaxed text-muted-foreground">
                {modeDescriptions[mode]}
              </p>
            </div>

            <div className="mt-auto rounded-md border border-primary/15 bg-primary/5 p-4 sm:p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary-deep">Siap untuk kelas</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Mulai latihan dari web, atau lihat cara kerja konsol TuturAI.
              </p>
              <Link
                href="/auth/sign-up"
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Mulai Latihan Gratis
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
