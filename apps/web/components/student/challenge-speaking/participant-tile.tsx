'use client'

import { useEffect, useRef } from 'react'
import { Camera, Loader2, MessageSquare, Mic, MicOff, UserRound, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock, initialsOf } from './format'
import type { TileState } from './types'

interface ParticipantTileProps {
  role: 'local' | 'remote'
  name: string
  level: number
  levelLabel?: string
  state: TileState
  micOn: boolean
  cameraOn: boolean
  stream?: MediaStream | null
  searchSeconds?: number
  isDemo?: boolean
  cameraPending?: boolean
  compact?: boolean
  onEnableCamera?: () => void
  className?: string
}

function stateCopy(state: TileState, searchSeconds: number) {
  switch (state) {
    case 'waiting':
      return { label: 'Menunggu partner', detail: 'Partner akan muncul di sini' }
    case 'searching':
      return { label: 'Mencari partner', detail: formatClock(searchSeconds) }
    case 'connecting':
      return { label: 'Menghubungkan', detail: 'Menyiapkan koneksi media' }
    case 'reconnecting':
      return { label: 'Menyambung ulang', detail: 'Mencoba memulihkan koneksi' }
    case 'left':
      return { label: 'Partner keluar', detail: 'Sesi berakhir untuk peserta ini' }
    case 'ended':
      return { label: 'Sesi selesai', detail: 'Ringkasan tersedia di bawah' }
    case 'audio':
      return { label: 'Mode audio', detail: 'Kamera tidak aktif' }
    case 'text':
      return { label: 'Mode teks', detail: 'Percakapan lewat obrolan' }
    default:
      return null
  }
}

export function ParticipantTile({
  role,
  name,
  level,
  levelLabel,
  state,
  micOn,
  cameraOn,
  stream,
  searchSeconds = 0,
  isDemo = false,
  cameraPending = false,
  compact = false,
  onEnableCamera,
  className,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const showVideo = role === 'local' && cameraOn && Boolean(stream)
  const copy = stateCopy(state, searchSeconds)
  const isBusy = state === 'searching' || state === 'connecting' || state === 'reconnecting'
  const showMediaBadges =
    role === 'local' || ['live', 'audio', 'text', 'reconnecting', 'left', 'ended'].includes(state)

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    element.srcObject = stream ?? null
  }, [stream])

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <div className="relative">
            {state === 'searching' && (
              <>
                <span
                  aria-hidden
                  className="absolute -inset-2.5 rounded-full border border-primary/50 motion-safe:animate-ping"
                />
                <span
                  aria-hidden
                  className="absolute -inset-5 rounded-full border border-primary/20 motion-safe:animate-pulse"
                />
              </>
            )}
            <span
              className={cn(
                'relative flex items-center justify-center rounded-full bg-white/10 font-heading font-bold text-ink-foreground ring-1 ring-white/15',
                compact ? 'h-11 w-11 text-sm' : 'h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl',
                state === 'left' && 'text-ink-muted',
              )}
            >
              {role === 'local' || showMediaBadges ? initialsOf(name) : <UserRound className="h-6 w-6" />}
            </span>
          </div>

          {copy && (
            <div className="space-y-1">
              <p
                className={cn(
                  'flex items-center justify-center gap-1.5 font-mono uppercase text-ink-foreground',
                  compact ? 'text-[9px] tracking-[0.12em]' : 'text-[10px] tracking-[0.18em]',
                )}
              >
                {isBusy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {copy.label}
              </p>
              {!compact && <p className="font-mono text-[10px] tabular-nums text-ink-muted">{copy.detail}</p>}
            </div>
          )}

          {role === 'local' && !cameraOn && onEnableCamera && !compact && (
            <button
              type="button"
              onClick={onEnableCamera}
              disabled={cameraPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-foreground transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-60"
            >
              {cameraPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-3 w-3" aria-hidden />
              )}
              Nyalakan kamera
            </button>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
        <span className="rounded-full bg-black/45 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/85">
          {role === 'local' ? 'Kamu' : 'Partner'}
        </span>
        {isDemo && (
          <span className="rounded-full bg-warning/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-warning ring-1 ring-warning/30">
            Demo
          </span>
        )}
      </div>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent',
          compact ? 'px-2 pt-6 pb-1.5' : 'px-3 pt-8 pb-2.5',
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              'truncate font-heading font-bold tracking-tight text-white',
              compact ? 'text-[11px]' : 'text-[13px]',
            )}
          >
            {name}
          </p>
          <p
            className={cn(
              'font-mono uppercase text-white/60',
              compact ? 'text-[8px] tracking-[0.1em]' : 'text-[9px] tracking-[0.14em]',
            )}
          >
            {levelLabel ?? `Level ${level}`}
          </p>
        </div>
        <div className={cn('flex shrink-0 items-center gap-1', !showMediaBadges && 'hidden')}>
          <span
            className={cn(
              'flex items-center justify-center rounded-full',
              compact ? 'h-5 w-5' : 'h-6 w-6',
              micOn ? 'bg-white/15 text-white' : 'bg-destructive text-white',
            )}
            title={micOn ? 'Mikrofon aktif' : 'Mikrofon mati'}
          >
            {micOn ? <Mic className="h-3 w-3" aria-hidden /> : <MicOff className="h-3 w-3" aria-hidden />}
            <span className="sr-only">{micOn ? 'Mikrofon aktif' : 'Mikrofon mati'}</span>
          </span>
          <span
            className={cn(
              'flex items-center justify-center rounded-full',
              compact ? 'h-5 w-5' : 'h-6 w-6',
              cameraOn ? 'bg-white/15 text-white' : 'bg-white/10 text-white/70',
            )}
            title={cameraOn ? 'Kamera aktif' : 'Kamera mati'}
          >
            {cameraOn ? <Camera className="h-3 w-3" aria-hidden /> : <VideoOff className="h-3 w-3" aria-hidden />}
            <span className="sr-only">{cameraOn ? 'Kamera aktif' : 'Kamera mati'}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

export function EmptySlotTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 text-center',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-ink-muted">
        <UserRound className="h-4 w-4" aria-hidden />
      </span>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Slot tersedia</p>
      <p className="text-[11px] leading-relaxed text-ink-muted/80">Menunggu peserta lain bergabung</p>
    </div>
  )
}

export function TextModeNotice({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-foreground">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span>Sesi berjalan dalam mode teks. Buka obrolan untuk mulai menulis.</span>
      </p>
      <button
        type="button"
        onClick={onOpenChat}
        className="shrink-0 self-start rounded-full border border-white/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-foreground transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:self-auto"
      >
        Buka obrolan
      </button>
    </div>
  )
}
