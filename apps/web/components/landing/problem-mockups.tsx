'use client'

import { Check, Clock, Eye, Mic, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GSAPStagger } from './gsap-helpers'

type Tone = 'light' | 'dark'

/** Fixed-height stage so all four cards show identically sized panels. */
function Stack({ children }: { children: React.ReactNode }) {
  return (
    <GSAPStagger className="flex w-full flex-col gap-2" y={18} scale={0.97} stagger={0.07}>
      {children}
    </GSAPStagger>
  )
}

function Panel({
  tone = 'light',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-stagger
      className={cn(
        'relative z-10 flex h-[142px] flex-col overflow-hidden rounded-[5px] border p-3 shadow-[0_20px_44px_-22px_rgba(0,0,0,0.7)] backdrop-blur-md',
        tone === 'dark' ? 'border-white/12 bg-ink-deep/90' : 'border-white/55 bg-card/92',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          tone === 'dark' ? 'bg-white/15' : 'bg-white/80',
        )}
      />
      {children}
    </div>
  )
}

function Head({
  tone = 'light',
  right,
  children,
}: {
  tone?: Tone
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          'font-mono text-[9px] uppercase tracking-[0.16em]',
          tone === 'dark' ? 'text-white/45' : 'text-muted-foreground',
        )}
      >
        {children}
      </span>
      {right}
    </div>
  )
}

function Foot({
  tone = 'light',
  right,
  children,
}: {
  tone?: Tone
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mt-auto flex items-center justify-between gap-2 border-t pt-2',
        tone === 'dark' ? 'border-white/10' : 'border-border/70',
      )}
    >
      <span
        className={cn(
          'font-mono text-[8.5px] uppercase tracking-[0.12em]',
          tone === 'dark' ? 'text-white/40' : 'text-muted-foreground/80',
        )}
      >
        {children}
      </span>
      {right}
    </div>
  )
}

function Pill({
  tone = 'light',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]',
        tone === 'dark' ? 'bg-white/10 text-white/70' : 'bg-secondary text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-stagger className={cn('flex items-center gap-2', className)}>
      {children}
    </div>
  )
}

function Shimmer({ tone = 'light', className }: { tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'mock-shimmer block h-1.5 rounded-full',
        tone === 'dark' ? 'bg-white/10' : 'bg-muted-foreground/15',
        className,
      )}
      style={
        {
          '--shimmer': tone === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(29,29,31,0.10)',
        } as React.CSSProperties
      }
    />
  )
}

function Meter({ tone = 'light', value, className }: { tone?: Tone; value: number; className?: string }) {
  return (
    <span
      className={cn(
        'block h-1 overflow-hidden rounded-full',
        tone === 'dark' ? 'bg-white/12' : 'bg-secondary',
        className,
      )}
    >
      <span
        className={cn('block h-full rounded-full', tone === 'dark' ? 'bg-white/55' : 'bg-primary')}
        style={{ width: `${value}%` }}
      />
    </span>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-white/12 font-mono text-[7px] font-semibold tracking-[0.02em] text-white/70">
      {initials}
    </span>
  )
}

export function MuteMockup() {
  return (
    <Stack>
      <Panel>
        <Head
          right={
            <span className="relative flex size-5 items-center justify-center rounded-[4px] bg-primary/12">
              <span className="animate-pulse-ring absolute inset-0 rounded-[4px] bg-primary/25" />
              <Mic className="relative size-3 text-primary" strokeWidth={1.75} />
            </span>
          }
        >
          Sesi speaking
        </Head>
        <p className="mt-2.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
          Ceritakan harimu
          <span className="mock-blink ml-0.5 inline-block h-3.5 w-px translate-y-px bg-primary align-middle" />
        </p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Jawab dalam 3–4 kalimat.
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-mono text-[8.5px] text-muted-foreground">[2 MENIT]</span>
          <span className="h-2.5 w-px bg-border" />
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="mock-ripple size-1.5 rounded-full bg-primary"
                style={{ animationDelay: `${i * 0.24}s` }}
              />
            ))}
          </div>
          <span className="font-mono text-[8.5px] text-muted-foreground">3 soal</span>
          <span className="ml-auto font-mono text-[8.5px] text-muted-foreground">0:00</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="mock-fill h-full rounded-full bg-primary" />
        </div>
        <Foot right={<span className="font-mono text-[8.5px] text-muted-foreground">0%</span>}>
          Belum dimulai
        </Foot>
      </Panel>

      <Panel tone="dark">
        <Head
          tone="dark"
          right={
            <Pill tone="dark">
              <span className="mock-blink size-1 rounded-full bg-white/70" />
              Menunggu
            </Pill>
          }
        >
          Catatan
        </Head>
        <div className="mt-2.5 flex flex-col gap-2">
          {['Paham semua soal', 'Tahu jawabannya', 'Tidak keluar suara'].map((line) => (
            <Row key={line}>
              <span className="size-2.5 shrink-0 rounded-[2px] border border-white/25" />
              <span className="text-[11px] leading-tight text-white/75">{line}</span>
              <Shimmer tone="dark" className="ml-auto w-6" />
            </Row>
          ))}
        </div>
        <Foot tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">0/3</span>}>
          0 dari 3 terisi
        </Foot>
      </Panel>
    </Stack>
  )
}

const wave = [4, 6, 3, 8, 5, 3, 7, 4, 3, 6, 4, 9, 5, 3, 6, 4, 3, 7, 5, 3, 6, 4, 8, 3]

export function AnxietyMockup() {
  return (
    <Stack>
      <Panel>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <div className="relative overflow-hidden rounded-[3px] bg-secondary">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="relative flex size-8 items-center justify-center">
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-primary/20" />
                <span className="relative flex size-6 items-center justify-center rounded-full bg-card shadow-sm">
                  <Mic className="size-3 text-primary" strokeWidth={1.75} />
                </span>
              </span>
            </div>
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-[2px] bg-card/90 px-1 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-foreground">
              <span className="mock-blink size-1 rounded-full bg-destructive" />
              Kamu
            </span>
            <span className="absolute bottom-1.5 left-1.5 font-mono text-[7.5px] text-muted-foreground">
              0:00
            </span>
          </div>
          <div className="relative overflow-hidden rounded-[3px] bg-ink-deep">
            <div className="absolute inset-0 flex items-center justify-center">
              <Eye className="size-4 text-white/35" strokeWidth={1.5} />
            </div>
            <span className="mock-scan absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-transparent via-white/20 to-transparent" />
            <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-white/15 px-1 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-white/80">
              Dinilai
            </span>
            <span className="absolute bottom-1.5 right-1.5 rounded-[2px] bg-primary/30 px-1 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-white/85">
              AI
            </span>
          </div>
        </div>
        <Foot right={<span className="font-mono text-[8.5px] text-muted-foreground">belum ada suara</span>}>
          Rekaman
        </Foot>
      </Panel>

      <Panel tone="dark">
        <Head tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">0:00</span>}>
          Terdengar
        </Head>
        <div className="relative mt-2 flex flex-1 items-end gap-[3px]">
          {wave.map((h, i) => (
            <span
              key={i}
              className="mock-bar w-[2px] origin-bottom rounded-full bg-linear-to-t from-primary/70 to-white/45"
              style={{ height: `${h * 2.4}px`, animationDelay: `${i * 0.07}s` }}
            />
          ))}
          <span aria-hidden className="absolute inset-y-0 left-[38%] w-px bg-white/25" />
        </div>
        <Foot tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">menunggu</span>}>
          0 kata terdeteksi
        </Foot>
      </Panel>
    </Stack>
  )
}

export function CrowdedMockup() {
  return (
    <Stack>
      <Panel>
        <Head right={<span className="font-mono text-[8.5px] text-foreground">36 siswa</span>}>
          Kelas 11-A
        </Head>
        <div className="mt-2 grid flex-1 grid-cols-[repeat(12,minmax(0,1fr))] content-center gap-1.5">
          {Array.from({ length: 36 }, (_, i) =>
            i === 0 ? (
              <span key={i} className="relative aspect-square w-full max-w-4 justify-self-center">
                <span className="absolute inset-0 rounded-full bg-primary" />
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-primary/40" />
              </span>
            ) : (
              <span
                key={i}
                className="mock-ripple aspect-square w-full max-w-4 justify-self-center rounded-full bg-muted-foreground"
                style={{ animationDelay: `${(i % 12) * 0.08 + Math.floor(i / 12) * 0.16}s` }}
              />
            ),
          )}
        </div>
        <Foot right={<Meter value={8} className="w-16" />}>1 guru · 35 siswa</Foot>
      </Panel>

      <Panel tone="dark">
        <Head tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">36</span>}>
          Antrean umpan balik
        </Head>
        <div className="mt-2.5 flex flex-col gap-2">
          {[
            ['01', 'SR', 'Siswa 01'],
            ['02', 'DW', 'Siswa 02'],
            ['03', 'AP', 'Siswa 03'],
          ].map(([index, initials, name]) => (
            <Row key={index}>
              <span className="font-mono text-[8px] text-white/35">{index}</span>
              <Avatar initials={initials} />
              <span className="text-[11px] leading-tight text-white/75">{name}</span>
              <Shimmer tone="dark" className="ml-auto w-7" />
            </Row>
          ))}
        </div>
        <Foot tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">0/36</span>}>
          36 menunggu
        </Foot>
      </Panel>
    </Stack>
  )
}

export function OfflineMockup() {
  return (
    <Stack>
      <Panel>
        <Head
          right={
            <Pill>
              <WifiOff className="size-2" strokeWidth={2} />
              Offline
            </Pill>
          }
        >
          Latihan
        </Head>
        <p className="mt-2.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
          Speaking, set 3
        </p>
        <div className="mt-2.5 flex items-center gap-1">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className={cn('mock-seg h-1.5 flex-1 rounded-full', i < 3 ? 'bg-primary' : 'bg-secondary')}
              style={{ animationDelay: `${0.1 + i * 0.06}s` }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-mono text-[8.5px] text-muted-foreground">3 dari 8 soal</span>
          <span className="h-2.5 w-px bg-border" />
          <Pill>
            <Check className="size-2" strokeWidth={2.5} />
            Tersimpan
          </Pill>
        </div>
        <Foot right={<span className="font-mono text-[8.5px] text-muted-foreground">0:00</span>}>
          Sinkron otomatis saat online
        </Foot>
      </Panel>

      <Panel tone="dark">
        <Head tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">3 file</span>}>
          Tersimpan lokal
        </Head>
        <div className="mt-2.5 flex flex-col gap-2">
          {[
            ['Rekaman 1', '1,2 MB'],
            ['Rekaman 2', '0,9 MB'],
            ['Rekaman 3', '1,4 MB'],
          ].map(([name, size]) => (
            <Row key={name}>
              <Clock className="size-2.5 shrink-0 text-white/35" strokeWidth={1.5} />
              <span className="text-[11px] leading-tight text-white/75">{name}</span>
              <span className="ml-auto font-mono text-[8px] text-white/35">{size}</span>
              <span className="flex size-3 items-center justify-center rounded-full bg-white/12">
                <Check className="size-2 text-white/75" strokeWidth={3} />
              </span>
            </Row>
          ))}
        </div>
        <Foot tone="dark" right={<span className="font-mono text-[8.5px] text-white/40">0/3</span>}>
          <span className="inline-flex items-center gap-1">
            <span className="mock-blink size-1 rounded-full bg-white/60" />
            Menunggu sinyal
          </span>
        </Foot>
      </Panel>
    </Stack>
  )
}
