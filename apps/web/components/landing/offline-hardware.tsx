'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Cpu, Rotate3d, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewPreset } from './device-scene'

const DeviceScene = dynamic(() => import('./device-scene').then((m) => m.DeviceScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Memuat model 3D
      </span>
    </div>
  ),
})

const features = [
  {
    icon: WifiOff,
    title: 'Tetap jalan offline',
    body: 'Speaking, reading, dan kuis dasar aktif tanpa sinyal — termasuk di sekolah wilayah 3T.',
    meta: 'PWA + antrean microSD',
  },
  {
    icon: Cpu,
    title: 'AI di dalam perangkat',
    body: 'DS-CNN INT8 memproses suara langsung di ESP32-S3. Audio tidak dikirim ke cloud.',
    meta: 'INT8 · TFLite Micro',
  },
  {
    icon: BatteryCharging,
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
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-card"
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-sm transition-transform',
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
    <section
      id="offline"
      data-nav-theme="light"
      className="section-y scroll-mt-24 bg-card px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Perangkat
          </p>
          <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-balance text-foreground sm:text-4xl lg:text-5xl">
            Tanpa <span className="text-primary">internet</span>. Tanpa ponsel pribadi.
          </h2>
          <p className="mt-6 leading-relaxed text-muted-foreground text-pretty">
            Satu konsol untuk seluruh kelas, tanpa kuota. Penilaian berjalan di perangkat, bukan di
            cloud.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,0.85fr)] lg:items-start">
          <div className="order-2 flex flex-col gap-4 lg:order-1">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-xl border border-border bg-secondary/60 p-5 transition-colors hover:border-primary/40"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold tracking-[-0.01em] text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {feature.body}
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {feature.meta}
                </p>
              </article>
            ))}
          </div>

          <div className="order-1 lg:order-2">
            <div
              ref={stage}
              className="relative h-[340px] overflow-hidden rounded-2xl border border-border bg-secondary/50 sm:h-[420px] lg:h-[480px]"
            >
              {ready ? (
                <DeviceScene
                  preset={preset}
                  exploded={exploded}
                  autoRotate={autoRotate}
                  showTop={showTop}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Memuat model 3D
                  </span>
                </div>
              )}
              <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                <Rotate3d className="h-3 w-3" aria-hidden />
                Geser 360°
              </span>
            </div>
            <p className="mt-4 text-center text-sm leading-relaxed text-muted-foreground text-pretty">
              Konsol ESP32-S3 dengan layar TFT, mikrofon, dan speaker. Semua penilaian berjalan di
              perangkat.
            </p>
          </div>

          <div className="order-3 flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-secondary/60 p-5">
              <h3 className="font-display text-sm font-semibold text-foreground">Tampilan</h3>
              <div className="mt-2 flex flex-col">
                <Toggle label="Urai (exploded)" checked={exploded} onChange={setExploded} />
                <Toggle label="Putar otomatis" checked={autoRotate} onChange={setAutoRotate} />
                <Toggle label="Casing atas" checked={showTop} onChange={setShowTop} />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Sudut pandang
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {views.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setPreset(view.id)}
                      aria-pressed={preset === view.id}
                      className={cn(
                        'rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
                        preset === view.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:border-primary/50',
                      )}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Link
              href="/auth/sign-up"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Mulai Latihan Gratis
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
