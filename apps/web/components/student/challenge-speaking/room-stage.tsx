'use client'

import { Check, Copy, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialsOf } from './match-stage'

interface RoomParticipant {
  uid: string
  name: string
  role?: string
  isMuted?: boolean
  isCameraOff?: boolean
  isSpeaking?: boolean
}

interface RoomStageProps {
  topic: string
  gameModel: 'instruction' | 'freeplay'
  myRole: string
  instruction: string
  mode: '1v1' | 'group' | 'private'
  maxParticipants: number
  code?: string
  participants: RoomParticipant[]
  livekit: {
    connected: boolean
    connecting: boolean
    error: string | null
    isMuted: boolean
    isCameraOff: boolean
    toggleMute: () => void
    toggleCamera: () => void
  }
  copied: boolean
  onCopyCode: () => void
  onLeave: () => void
}

export function RoomStage({
  topic,
  gameModel,
  myRole,
  instruction,
  mode,
  maxParticipants,
  code,
  participants,
  livekit,
  copied,
  onCopyCode,
  onLeave,
}: RoomStageProps) {
  const is1v1 = maxParticipants <= 2
  const display: RoomParticipant[] =
    participants.length > 0
      ? participants
      : [{ uid: 'me', name: 'Kamu', role: 'speaker_1', isMuted: false, isCameraOff: false }]
  const emptySlots = Math.max(0, maxParticipants - display.length)

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="border border-rule bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-rule bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Topik sesi
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
            {display.length}/{maxParticipants} peserta
          </span>
        </div>
        <p className="px-4 py-3 text-balance font-heading text-base font-bold leading-snug text-foreground">
          {topic}
        </p>
      </div>

      {gameModel === 'instruction' ? (
        <div className="border border-rule bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-rule bg-secondary/50 px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary-deep">
              Instruksimu
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {myRole.replace('_', ' ')}
            </span>
          </div>
          <p className="px-4 py-3 text-[13px] leading-relaxed text-foreground">{instruction}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-rule bg-card px-4 py-2.5">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-success" />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Free play · bicara bebas tanpa instruksi
          </p>
        </div>
      )}

      <div className="border border-ink-deep bg-ink-deep dark:border-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full',
                  livekit.connected ? 'animate-ping bg-success' : 'bg-warning',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-1.5 w-1.5 rounded-full',
                  livekit.connected ? 'bg-success' : 'bg-warning',
                )}
              />
            </span>
            {livekit.connected ? 'Live' : livekit.connecting ? 'Menghubungkan' : 'Demo'}
          </span>

          {mode === 'private' && (
            <button
              type="button"
              onClick={onCopyCode}
              className="flex shrink-0 items-center gap-1.5 border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-foreground transition-colors hover:bg-white/10"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Tersalin' : code}
            </button>
          )}
        </div>

        <div
          className={cn(
            'grid gap-2 p-2 sm:gap-3 sm:p-3',
            is1v1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2',
          )}
        >
          {display.map((participant) => (
            <div
              key={participant.uid}
              className={cn(
                'relative aspect-video overflow-hidden border bg-white/[0.04]',
                participant.isSpeaking ? 'border-success' : 'border-white/10',
              )}
            >
              <div className="flex h-full w-full items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center border border-white/15 font-heading text-sm font-bold text-ink-foreground">
                  {initialsOf(participant.name)}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-4">
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white">
                  {participant.name}
                  {participant.uid === 'me' ? ' · kamu' : ''}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {participant.isMuted && <MicOff className="h-3 w-3 text-white/70" />}
                  {participant.isCameraOff && <VideoOff className="h-3 w-3 text-white/70" />}
                </span>
              </div>
            </div>
          ))}

          {Array.from({ length: emptySlots }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="flex aspect-video items-center justify-center border border-dashed border-white/15"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                Menunggu peserta
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={livekit.toggleMute}
            aria-pressed={livekit.isMuted}
            aria-label={livekit.isMuted ? 'Nyalakan mikrofon' : 'Matikan mikrofon'}
            className={cn(
              'flex h-12 w-12 items-center justify-center border transition-colors',
              livekit.isMuted
                ? 'border-destructive bg-destructive text-white'
                : 'border-white/15 text-ink-foreground hover:bg-white/10',
            )}
          >
            {livekit.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={livekit.toggleCamera}
            aria-pressed={livekit.isCameraOff}
            aria-label={livekit.isCameraOff ? 'Nyalakan kamera' : 'Matikan kamera'}
            className={cn(
              'flex h-12 w-12 items-center justify-center border transition-colors',
              livekit.isCameraOff
                ? 'border-destructive bg-destructive text-white'
                : 'border-white/15 text-ink-foreground hover:bg-white/10',
            )}
          >
            {livekit.isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Keluar dari room"
            className="flex h-12 items-center gap-2 border border-destructive bg-destructive px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90"
          >
            <PhoneOff className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {livekit.connected
          ? 'Terhubung ke LiveKit room'
          : livekit.error
            ? `Koneksi gagal: ${livekit.error} · mode demo`
            : 'Mode demo · LiveKit keys belum dikonfigurasi'}
      </p>
    </div>
  )
}
