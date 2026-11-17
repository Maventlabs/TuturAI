'use client'

import { LogOut, Square } from 'lucide-react'
import type { ConversationMode } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { VoiceOrb, type OrbState } from '@/components/student/ai-tutor/voice-orb'
import { cn } from '@/lib/utils'
import type { ConversationPhase } from './use-conversation'

interface VoiceDockProps {
  phase: ConversationPhase
  orbState: OrbState
  getLevel: () => number
  mode: ConversationMode
  onChangeMode: (mode: ConversationMode) => void
  onPrimary: () => void
  onInterrupt: () => void
  onEnd: () => void
  seconds: number
  handsFreeSpeaking: boolean
  ending: boolean
  disabled: boolean
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const MODES: Array<{ value: ConversationMode; label: string }> = [
  { value: 'push-to-talk', label: 'Push-to-talk' },
  { value: 'hands-free', label: 'Hands-free' },
]

export function VoiceDock({
  phase,
  orbState,
  getLevel,
  mode,
  onChangeMode,
  onPrimary,
  onInterrupt,
  onEnd,
  seconds,
  handsFreeSpeaking,
  ending,
  disabled,
}: VoiceDockProps) {
  const label =
    phase === 'listening'
      ? mode === 'hands-free'
        ? 'Mendengarkan'
        : 'Merekam'
      : phase === 'processing'
        ? 'Tutor berpikir'
        : phase === 'speaking'
          ? 'Tutor berbicara'
          : phase === 'error'
            ? 'Gangguan'
            : 'Siap'

  const hint =
    phase === 'listening'
      ? mode === 'hands-free'
        ? handsFreeSpeaking
          ? 'Bicara sekarang, saya dengarkan sampai kamu berhenti.'
          : 'Mulai bicara dalam Bahasa Inggris.'
        : `Ketuk lagi kalau sudah selesai · ${formatSeconds(seconds)}`
      : phase === 'processing'
        ? 'Menyusun jawaban dan koreksi…'
        : phase === 'speaking'
          ? 'Ketuk orb untuk menghentikan suara tutor.'
          : phase === 'error'
            ? 'Ketuk orb untuk mencoba lagi.'
            : mode === 'hands-free'
              ? 'Ketuk orb untuk mulai mendengarkan.'
              : 'Ketuk orb lalu bicara dalam Bahasa Inggris.'

  const primaryLabel =
    phase === 'listening'
      ? 'Hentikan rekaman'
      : phase === 'speaking'
        ? 'Hentikan suara tutor'
        : phase === 'processing'
          ? 'Tutor sedang memproses'
          : 'Mulai bicara'

  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20">
      <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrimary}
            disabled={disabled}
            aria-label={primaryLabel}
            className={cn(
              'relative h-16 w-16 shrink-0 rounded-full outline-none transition-transform duration-200',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              'disabled:cursor-not-allowed disabled:opacity-60',
              !disabled && 'hover:scale-[1.03] active:scale-[0.98]',
            )}
          >
            <VoiceOrb state={orbState} getLevel={getLevel} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm leading-snug text-foreground text-pretty">{hint}</p>
          </div>

          {phase === 'speaking' && (
            <Button variant="outline" size="icon" onClick={onInterrupt} aria-label="Hentikan suara tutor">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div role="group" aria-label="Mode percakapan" className="flex flex-1 rounded-lg bg-muted p-0.5">
            {MODES.map((option) => {
              const active = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChangeMode(option.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex-1 rounded-[7px] px-2 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onEnd}
            disabled={ending}
            className="gap-1.5 text-muted-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            {ending ? 'Menyiapkan…' : 'Akhiri sesi'}
          </Button>
        </div>
      </div>
    </div>
  )
}
