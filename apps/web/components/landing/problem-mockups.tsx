'use client'

import { Check, Clock, Eye, FileText, Mic, WifiOff } from 'lucide-react'
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
        'relative z-10 flex h-[140px] flex-col overflow-hidden rounded-[3px] border p-3 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.55)] backdrop-blur-sm',
        tone === 'dark' ? 'border-white/15 bg-ink-deep/92' : 'border-border bg-card/95',
        className,
      )}
    >
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
          'font-mono text-[10px] uppercase tracking-[0.14em]',
          tone === 'dark' ? 'text-white/45' : 'text-muted-foreground',
        )}
      >
        {children}
      </span>
      {right}
    </div>
  )
}

function Foot({ tone = 'light', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'mt-auto border-t pt-2 font-mono text-[9px] uppercase tracking-[0.1em]',
        tone === 'dark' ? 'border-white/10 text-white/35' : 'border-border text-muted-foreground/70',
      )}
    >
      {children}
    </p>
  )
}

function Pill({ tone = 'light', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]',
        tone === 'dark' ? 'bg-white/10 text-white/70' : 'bg-secondary text-muted-foreground',
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

export function MuteMockup() {
  return (
    <Stack>
      <Panel>
        <Head
          right={
            <span className="relative flex size-5 items-center justify-center rounded-[3px] bg-primary/10">
              <span className="animate-pulse-ring absolute inset-0 rounded-[3px] bg-primary/25" />
              <Mic className="relative size-3 text-primary" strokeWidth={1.75} />
            </span>
          }
        >
          Sesi speaking
        </Head>
        <p className="mt-2.5 text-sm font-medium leading-snug text-foreground">
          Ceritakan harimu
          <span className="mock-blink ml-0.5 inline-block h-3 w-px translate-y-px bg-primary align-middle" />
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[9px] text-muted-foreground">[2 MENIT]</span>
          <span className="h-2.5 w-px bg-border" />
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="mock-ripple size-2 rounded-full bg-primary"
                style={{ animationDelay: `${i * 0.24}s` }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">3 soal</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="mock-blink size-1.5 rounded-full bg-primary" />
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="mock-fill h-full rounded-full bg-primary" />
          </div>
        </div>
        <Foot>Belum dimulai</Foot>
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
              <span className="size-1 shrink-0 rounded-full bg-white/30" />
              <span className="text-[11px] leading-tight text-white/70">{line}</span>
              <Shimmer tone="dark" className="ml-auto w-6" />
            </Row>
          ))}
        </div>
        <Foot tone="dark">0 dari 3 terisi</Foot>
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
          <div className="relative overflow-hidden rounded-[2px] bg-secondary">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="relative flex size-7 items-center justify-center">
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-primary/20" />
                <Mic className="relative size-4 text-muted-foreground/50" strokeWidth={1.5} />
              </span>
            </div>
            <span className="absolute left-1 top-1 rounded-[2px] bg-card/90 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-foreground">
              Kamu
            </span>
          </div>
          <div className="relative overflow-hidden rounded-[2px] bg-ink-deep">
            <div className="absolute inset-0 flex items-center justify-center">
              <Eye className="size-4 text-white/35" strokeWidth={1.5} />
            </div>
            <span className="mock-scan absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-transparent via-white/20 to-transparent" />
            <span className="absolute left-1 top-1 rounded-[2px] bg-white/15 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/80">
              Dinilai
            </span>
          </div>
        </div>
      </Panel>

      <Panel tone="dark">
        <Head tone="dark" right={<span className="font-mono text-[9px] text-white/40">0:00</span>}>
          Terdengar
        </Head>
        <div className="mt-2 flex flex-1 items-end gap-[3px]">
          {wave.map((h, i) => (
            <span
              key={i}
              className="mock-bar w-[2px] origin-bottom rounded-full bg-white/30"
              style={{ height: `${h * 2.6}px`, animationDelay: `${i * 0.07}s` }}
            />
          ))}
        </div>
        <Foot tone="dark">0 kata terdeteksi</Foot>
      </Panel>
    </Stack>
  )
}

export function CrowdedMockup() {
  return (
    <Stack>
      <Panel>
        <Head right={<span className="font-mono text-[9px] text-foreground">36 siswa</span>}>
          Kelas 11-A
        </Head>
        <div className="mt-2.5 grid flex-1 grid-cols-[repeat(12,minmax(0,1fr))] content-center gap-1.5">
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
        <Foot>1 guru</Foot>
      </Panel>

      <Panel tone="dark">
        <Head tone="dark">Antrean umpan balik</Head>
        <div className="mt-2.5 flex flex-col gap-2">
          {['Siswa 01', 'Siswa 02', 'Siswa 03'].map((name, i) => (
            <Row key={name}>
              <span className="font-mono text-[8px] text-white/35">
                {String(i + 1).padStart(2, '0')}
              </span>
              <FileText className="size-2.5 shrink-0 text-white/35" strokeWidth={1.5} />
              <span className="text-[11px] leading-tight text-white/70">{name}</span>
              <Shimmer tone="dark" className="ml-auto w-8" />
            </Row>
          ))}
        </div>
        <Foot tone="dark">36 menunggu</Foot>
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
        <p className="mt-2.5 text-sm font-medium leading-snug text-foreground">Speaking — set 3</p>
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className={cn('mock-seg h-1 flex-1 rounded-full', i < 3 ? 'bg-primary' : 'bg-secondary')}
              style={{ animationDelay: `${0.1 + i * 0.06}s` }}
            />
          ))}
        </div>
        <Foot>3 dari 8 soal</Foot>
      </Panel>

      <Panel tone="dark">
        <Head tone="dark" right={<span className="font-mono text-[9px] text-white/40">3 file</span>}>
          Tersimpan lokal
        </Head>
        <div className="mt-2.5 flex flex-col gap-2">
          {['Rekaman 1', 'Rekaman 2', 'Rekaman 3'].map((name) => (
            <Row key={name}>
              <Clock className="size-2.5 shrink-0 text-white/35" strokeWidth={1.5} />
              <span className="text-[11px] leading-tight text-white/70">{name}</span>
              <span className="ml-auto flex size-3 items-center justify-center rounded-full bg-white/10">
                <Check className="size-2 text-white/60" strokeWidth={2.5} />
              </span>
            </Row>
          ))}
        </div>
        <Foot tone="dark">
          <span className="inline-flex items-center gap-1">
            <span className="mock-blink size-1 rounded-full bg-white/60" />
            Menunggu sinyal
          </span>
        </Foot>
      </Panel>
    </Stack>
  )
}
