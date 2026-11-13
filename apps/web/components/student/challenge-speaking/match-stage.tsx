'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function initialsOf(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function useSelfPreview() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [stream])

  const toggle = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      return
    }
    setPending(true)
    setError(null)
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      setStream(next)
    } catch {
      setError('Kamera tidak dapat diakses')
    } finally {
      setPending(false)
    }
  }, [stream])

  return { stream, error, pending, toggle, videoRef }
}

function CornerTicks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-primary" />
      <span className="absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-primary" />
      <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-primary" />
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-primary" />
    </span>
  )
}

interface MatchStageProps {
  state: 'standby' | 'scanning'
  name: string
  level: number
  meta?: string
  modeLabel: string
  gameLabel: string
  onlineCount: number | null
  countdown?: number
  footer: React.ReactNode
}

export function MatchStage({
  state,
  name,
  level,
  meta,
  modeLabel,
  gameLabel,
  onlineCount,
  countdown,
  footer,
}: MatchStageProps) {
  const { stream, error, pending, toggle, videoRef } = useSelfPreview()
  const scanning = state === 'scanning'

  return (
    <section className="relative overflow-hidden border border-ink-deep bg-ink-deep text-ink-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full',
                scanning ? 'animate-ping bg-primary' : 'bg-success',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-1.5 w-1.5 rounded-full',
                scanning ? 'bg-primary' : 'bg-success',
              )}
            />
          </span>
          {scanning ? 'Mencari partner' : 'Standby'}
        </span>

        <button
          type="button"
          onClick={toggle}
          aria-pressed={Boolean(stream)}
          className={cn(
            'flex h-7 items-center gap-1.5 border px-2 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors',
            stream
              ? 'border-primary/60 bg-primary/15 text-ink-foreground'
              : 'border-white/15 text-ink-muted hover:bg-white/10 hover:text-ink-foreground',
          )}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : stream ? (
            <CameraOff className="h-3 w-3" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
          {stream ? 'Matikan' : 'Kamera'}
        </button>
      </div>

      <div className="relative flex items-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden border border-white/15 bg-white/5 sm:h-32 sm:w-32">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full scale-x-[-1] object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-heading text-2xl font-extrabold tracking-tight text-ink-foreground sm:text-3xl">
              {initialsOf(name)}
            </span>
          )}
          {scanning && (
            <span aria-hidden className="tutur-scan-line absolute inset-x-0 h-px bg-primary" />
          )}
          <CornerTicks />
        </div>

        <div className="min-w-0 flex-1">
          {scanning ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Menghubungkan
              </p>
              <p className="mt-1.5 font-mono text-4xl font-medium leading-none tabular-nums">
                {String(countdown ?? 0).padStart(2, '0')}
                <span className="ml-0.5 text-base text-ink-muted">s</span>
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                Level ±1 · topik sama untuk semua peserta
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Kamu siap
              </p>
              <h2 className="mt-1.5 truncate font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
                {name}
              </h2>
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Level {level}
                {meta ? ` · ${meta}` : ''}
              </p>
            </>
          )}
        </div>

        <div className="hidden shrink-0 border-l border-white/10 pl-5 text-right sm:block">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Online</p>
          <p className="mt-1 font-mono text-2xl leading-none tabular-nums">
            {onlineCount === null ? '—' : onlineCount}
          </p>
        </div>
      </div>

      <dl className="relative flex divide-x divide-white/10 border-t border-white/10">
        <div className="min-w-0 flex-1 px-4 py-2.5">
          <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Mode</dt>
          <dd className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.1em]">
            {modeLabel} · {gameLabel}
          </dd>
        </div>
        <div className="px-4 py-2.5">
          <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Level</dt>
          <dd className="mt-0.5 font-mono text-[11px] tabular-nums">±1</dd>
        </div>
        <div className="px-4 py-2.5">
          <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Sesi</dt>
          <dd className="mt-0.5 font-mono text-[11px]">3–5 mnt</dd>
        </div>
      </dl>

      {error && (
        <p className="relative border-t border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
          {error}
        </p>
      )}

      <div className="relative border-t border-white/10 p-2.5">{footer}</div>
    </section>
  )
}

interface PresenceStripProps {
  users: Array<{ uid: string; name: string }>
  error: string | null
}

export function PresenceStrip({ users, error }: PresenceStripProps) {
  return (
    <div className="flex items-center gap-3 border border-rule bg-card px-3.5 py-2.5">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Siswa online
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {users.slice(0, 6).map((user) => (
          <span
            key={user.uid}
            title={user.name}
            className="flex h-6 w-6 shrink-0 items-center justify-center border border-rule bg-secondary font-mono text-[9px] uppercase text-muted-foreground"
          >
            {initialsOf(user.name)}
          </span>
        ))}
        {users.length > 6 && (
          <span className="ml-0.5 font-mono text-[10px] text-muted-foreground">
            +{users.length - 6}
          </span>
        )}
        {users.length === 0 && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {error ?? 'Menunggu siswa lain'}
          </span>
        )}
      </div>
    </div>
  )
}
