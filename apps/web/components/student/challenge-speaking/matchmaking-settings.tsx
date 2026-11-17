'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Hash,
  KeyRound,
  Lock,
  MessageSquare,
  MessagesSquare,
  Mic,
  Square,
  Target,
  User,
  Users,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock } from './format'
import {
  MATCH_MODE_LABEL,
  MEDIA_LABEL,
  type GameModel,
  type MatchMode,
  type MediaPreference,
} from './types'

function SectionHeader({ index, title, value }: { index: string; title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule px-3.5 py-2.5">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-foreground">{index}</span> · {title}
      </h2>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep">{value}</span>
    </div>
  )
}

function ModeCard({
  selected,
  icon: Icon,
  title,
  description,
  onSelect,
  disabled,
}: {
  selected: boolean
  icon: typeof Target
  title: string
  description: string
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'bg-primary/[0.07] ring-primary/60'
          : 'bg-card ring-rule hover:bg-secondary/50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-heading text-[13px] font-bold tracking-tight',
            selected ? 'text-primary-deep' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1',
          selected ? 'bg-primary text-primary-foreground ring-primary' : 'ring-border',
        )}
      >
        {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
    </button>
  )
}

function MatchTypeRow({
  selected,
  icon: Icon,
  title,
  description,
  meta,
  onSelect,
  disabled,
}: {
  selected: boolean
  icon: typeof User
  title: string
  description: string
  meta: string
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'bg-primary/[0.06]' : 'hover:bg-secondary/50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
          selected
            ? 'bg-primary text-primary-foreground ring-primary'
            : 'bg-secondary/60 text-muted-foreground ring-rule',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-heading text-[13px] font-bold tracking-tight',
            selected ? 'text-primary-deep' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{meta}</span>
    </button>
  )
}

const MEDIA_OPTIONS: Array<{ value: MediaPreference; label: string; icon: typeof Video }> = [
  { value: 'video', label: 'Video + Audio', icon: Video },
  { value: 'audio', label: 'Audio Saja', icon: Mic },
  { value: 'text', label: 'Teks', icon: MessageSquare },
]

interface MatchmakingSettingsProps {
  gameModel: GameModel
  matchMode: MatchMode
  mediaPreference: MediaPreference
  level: number
  locked: boolean
  roomCode: string | null
  joinCode: string
  copied: boolean
  onGameModelChange: (model: GameModel) => void
  onMatchModeChange: (mode: MatchMode) => void
  onMediaPreferenceChange: (preference: MediaPreference) => void
  onJoinCodeChange: (value: string) => void
  onJoin: () => void
  onCopyCode: () => void
}

export function MatchmakingSettings({
  gameModel,
  matchMode,
  mediaPreference,
  level,
  locked,
  roomCode,
  joinCode,
  copied,
  onGameModelChange,
  onMatchModeChange,
  onMediaPreferenceChange,
  onJoinCodeChange,
  onJoin,
  onCopyCode,
}: MatchmakingSettingsProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(true)

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {locked && (
        <p className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground lg:col-span-3">
          <Lock className="h-3 w-3" aria-hidden />
          Pengaturan dikunci selama pencarian
        </p>
      )}
      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <SectionHeader index="01" title="Mode percakapan" value={gameModel === 'instruction' ? 'Instruksi' : 'Bebas'} />
        <div role="radiogroup" aria-label="Mode percakapan" className="space-y-2 p-3">
          <ModeCard
            selected={gameModel === 'instruction'}
            icon={Target}
            title="Instruction Mode"
            description="Latihan terarah dengan misi dan tujuan percakapan."
            onSelect={() => onGameModelChange('instruction')}
            disabled={locked}
          />
          <ModeCard
            selected={gameModel === 'freeplay'}
            icon={MessagesSquare}
            title="Free Play Mode"
            description="Ngobrol natural tanpa misi tetap."
            onSelect={() => onGameModelChange('freeplay')}
            disabled={locked}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <SectionHeader index="02" title="Tipe matching" value={MATCH_MODE_LABEL[matchMode]} />
        <div role="radiogroup" aria-label="Tipe matching" className="divide-y divide-rule">
          <MatchTypeRow
            selected={matchMode === '1v1'}
            icon={User}
            title="Random 1v1"
            description="Dipasangkan dengan satu siswa lain."
            meta="2 orang"
            onSelect={() => onMatchModeChange('1v1')}
            disabled={locked}
          />
          <MatchTypeRow
            selected={matchMode === 'group'}
            icon={Users}
            title="Random Group"
            description="Sesi grup hingga empat peserta."
            meta="Maks 4"
            onSelect={() => onMatchModeChange('group')}
            disabled={locked}
          />
          <MatchTypeRow
            selected={matchMode === 'private'}
            icon={Hash}
            title="Private Room"
            description="Buat room dengan kode, ajak teman."
            meta="Kode"
            onSelect={() => onMatchModeChange('private')}
            disabled={locked}
          />
        </div>

        {matchMode === 'private' && (
          <div className="border-t border-rule bg-secondary/30 px-3.5 py-3">
            {roomCode ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Kode room</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-mono text-base tracking-[0.28em] text-foreground">{roomCode}</span>
                  <button
                    type="button"
                    onClick={onCopyCode}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Copy className="h-3 w-3" aria-hidden />
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Bagikan kode ini ke teman sekelas. Room menunggu hingga peserta bergabung.
                </p>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="join-code"
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <KeyRound className="h-3 w-3" aria-hidden />
                  Punya kode dari teman?
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="join-code"
                    value={joinCode}
                    onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && joinCode.length >= 4) onJoin()
                    }}
                    placeholder="KODE"
                    maxLength={6}
                    autoComplete="off"
                    disabled={locked}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-center font-mono text-sm uppercase tracking-[0.3em] text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={onJoin}
                    disabled={locked || joinCode.length < 4}
                    className="h-10 shrink-0 rounded-lg bg-foreground px-4 font-heading text-[12px] font-bold text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Gabung
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <button
          type="button"
          onClick={() => setPreferencesOpen((value) => !value)}
          aria-expanded={preferencesOpen}
          aria-controls="session-preferences"
          className="flex w-full items-center justify-between gap-3 border-b border-rule px-3.5 py-2.5 text-left transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-foreground">03</span> · Preferensi sesi
          </h2>
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep">
            {MEDIA_LABEL[mediaPreference]}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', preferencesOpen && 'rotate-180')}
              aria-hidden
            />
          </span>
        </button>

        {preferencesOpen && (
          <div id="session-preferences" className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-2.5 py-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden />
                Level Inggris
              </span>
              <span className="font-mono text-[11px] tabular-nums text-foreground">Level {level}</span>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Preferensi media</p>
              <div role="radiogroup" aria-label="Preferensi media" className="mt-1.5 grid grid-cols-3 gap-1.5">
                {MEDIA_OPTIONS.map((option) => {
                  const selected = mediaPreference === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onMediaPreferenceChange(option.value)}
                      disabled={locked}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                        selected
                          ? 'bg-primary/[0.08] text-primary-deep ring-primary/60'
                          : 'text-muted-foreground ring-rule hover:bg-secondary/50',
                      )}
                    >
                      <option.icon className="h-3.5 w-3.5" aria-hidden />
                      <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.08em]">
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-2.5 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Durasi sesi</span>
              <span className="font-mono text-[11px] text-foreground">3–5 menit</span>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Pencocokan hanya dengan level sama atau selisih satu level. Verifikasi dilakukan di server.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

interface PrimaryActionProps {
  searching: boolean
  label: string
  meta: string
  searchSeconds: number
  disabled?: boolean
  onStart: () => void
  onCancel: () => void
}

export function PrimaryAction({ searching, label, meta, searchSeconds, disabled, onStart, onCancel }: PrimaryActionProps) {
  if (searching) {
    return (
      <button
        type="button"
        onClick={onCancel}
        className="group flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-card px-4 text-foreground ring-1 ring-foreground/15 transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex items-center gap-2 font-heading text-sm font-bold tracking-tight">
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
          Batalkan pencarian
        </span>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="tabular-nums">{formatClock(searchSeconds)}</span>
          berjalan
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="group flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="font-heading text-sm font-bold tracking-tight">{label}</span>
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
        {meta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </button>
  )
}
