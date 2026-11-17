'use client'

import { Loader2, MessageSquare, Mic, MicOff, PhoneOff, Settings2, ShieldAlert, Target, Video, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ControlButtonProps {
  label: string
  pressed?: boolean
  tone?: 'default' | 'off'
  onClick: () => void
  disabled?: boolean
  pending?: boolean
  badge?: number
  children: React.ReactNode
}

function ControlButton({ label, pressed, tone = 'default', onClick, disabled, pending, badge, children }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11',
        tone === 'off'
          ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/30 hover:bg-destructive/15'
          : 'bg-secondary text-foreground hover:bg-secondary/70',
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children}
      {typeof badge === 'number' && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  )
}

interface CallControlsProps {
  micOn: boolean
  cameraOn: boolean
  micPending?: boolean
  cameraPending?: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onOpenDevices: () => void
  onOpenChat?: () => void
  onOpenMission?: () => void
  onOpenReport?: () => void
  onLeave?: () => void
  leaveLabel: string
  leaveTone?: 'neutral' | 'danger'
  disabled?: boolean
  unreadCount?: number
  hint?: string
}

export function CallControls({
  micOn,
  cameraOn,
  micPending,
  cameraPending,
  onToggleMic,
  onToggleCamera,
  onOpenDevices,
  onOpenChat,
  onOpenMission,
  onOpenReport,
  onLeave,
  leaveLabel,
  leaveTone = 'danger',
  disabled,
  unreadCount,
  hint,
}: CallControlsProps) {
  return (
    <div className="rounded-2xl bg-card px-2 py-2 ring-1 ring-foreground/10">
      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
        <ControlButton
          label={micOn ? 'Matikan mikrofon' : 'Nyalakan mikrofon'}
          pressed={micOn}
          tone={micOn ? 'default' : 'off'}
          onClick={onToggleMic}
          disabled={disabled}
          pending={micPending}
        >
          {micOn ? <Mic className="h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
        </ControlButton>

        <ControlButton
          label={cameraOn ? 'Matikan kamera' : 'Nyalakan kamera'}
          pressed={cameraOn}
          tone={cameraOn ? 'default' : 'off'}
          onClick={onToggleCamera}
          disabled={disabled}
          pending={cameraPending}
        >
          {cameraOn ? <Video className="h-4 w-4" aria-hidden /> : <VideoOff className="h-4 w-4" aria-hidden />}
        </ControlButton>

        <ControlButton label="Pengaturan perangkat" onClick={onOpenDevices} disabled={disabled}>
          <Settings2 className="h-4 w-4" aria-hidden />
        </ControlButton>

        {onOpenChat && (
          <ControlButton label="Buka obrolan" onClick={onOpenChat} disabled={disabled} badge={unreadCount}>
            <MessageSquare className="h-4 w-4" aria-hidden />
          </ControlButton>
        )}

        {onOpenMission && (
          <ControlButton label="Lihat misi sesi" onClick={onOpenMission} disabled={disabled}>
            <Target className="h-4 w-4" aria-hidden />
          </ControlButton>
        )}

        {onOpenReport && (
          <ControlButton label="Laporkan peserta" onClick={onOpenReport} disabled={disabled}>
            <ShieldAlert className="h-4 w-4" aria-hidden />
          </ControlButton>
        )}

        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            aria-label={leaveLabel}
            title={leaveLabel}
            className={cn(
              'ml-0.5 flex h-10 items-center justify-center gap-2 rounded-full px-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none sm:h-11 sm:px-4',
              leaveTone === 'danger'
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-secondary text-foreground hover:bg-secondary/70',
            )}
          >
            <PhoneOff className="h-4 w-4" aria-hidden />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] sm:inline">{leaveLabel}</span>
          </button>
        )}
      </div>

      {hint && (
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
