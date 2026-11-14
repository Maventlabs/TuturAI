'use client'

import { Check, Hash, KeyRound, Users, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type GameModel = 'instruction' | 'freeplay'
type MatchMode = '1v1' | 'group' | 'private'

function SectionHeader({
  id,
  index,
  title,
  value,
}: {
  id: string
  index: string
  title: string
  value: string
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-rule bg-secondary/50 px-4 py-2.5">
      <h2
        id={id}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        <span className="text-foreground">{index}</span> · {title}
      </h2>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep">
        {value}
      </span>
    </header>
  )
}

function GameOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
        selected ? 'bg-primary/[0.06]' : 'hover:bg-secondary/60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
          selected ? 'border-primary bg-primary' : 'border-border bg-card',
        )}
      >
        {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-heading text-sm font-bold tracking-tight',
            selected ? 'text-primary-deep' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}

function MatchOption({
  selected,
  icon: Icon,
  title,
  description,
  meta,
  onSelect,
}: {
  selected: boolean
  icon: typeof Users
  title: string
  description: string
  meta: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
        selected ? 'bg-primary/[0.06]' : 'hover:bg-secondary/60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center border transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-rule bg-secondary/60 text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-heading text-sm font-bold tracking-tight',
            selected ? 'text-primary-deep' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {meta}
      </span>
    </button>
  )
}

interface SettingsConsoleProps {
  gameModel: GameModel
  onGameModelChange: (model: GameModel) => void
  matchMode: MatchMode
  onMatchModeChange: (mode: MatchMode) => void
  joinCode: string
  onJoinCodeChange: (value: string) => void
  onJoin: () => void
}

export function SettingsConsole({
  gameModel,
  onGameModelChange,
  matchMode,
  onMatchModeChange,
  joinCode,
  onJoinCodeChange,
  onJoin,
}: SettingsConsoleProps) {
  return (
    <div className="border border-rule bg-card">
      <section>
        <SectionHeader
          id="mode-permainan"
          index="01"
          title="Mode permainan"
          value={gameModel === 'instruction' ? 'Instruksi' : 'Bebas'}
        />
        <div role="radiogroup" aria-labelledby="mode-permainan" className="divide-y divide-rule">
          <GameOption
            selected={gameModel === 'instruction'}
            title="Instruction Mode"
            description="Setiap siswa dapat instruksi berbeda di topik yang sama."
            onSelect={() => onGameModelChange('instruction')}
          />
          <GameOption
            selected={gameModel === 'freeplay'}
            title="Free Play Mode"
            description="Bicara bebas seperti Omegle, tanpa instruksi khusus."
            onSelect={() => onGameModelChange('freeplay')}
          />
        </div>
      </section>

      <section className="border-t border-rule">
        <SectionHeader
          id="mode-matching"
          index="02"
          title="Mode matching"
          value={
            matchMode === '1v1' ? '1v1' : matchMode === 'group' ? 'Grup' : 'Private'
          }
        />
        <div role="radiogroup" aria-labelledby="mode-matching" className="divide-y divide-rule">
          <MatchOption
            selected={matchMode === '1v1'}
            icon={Users}
            title="Random 1v1"
            description="Dipasangkan dengan 1 siswa lain secara acak."
            meta="2 orang"
            onSelect={() => onMatchModeChange('1v1')}
          />
          <MatchOption
            selected={matchMode === 'group'}
            icon={UsersRound}
            title="Random Group"
            description="Dipasangkan dengan hingga 3 siswa lain."
            meta="Maks 4"
            onSelect={() => onMatchModeChange('group')}
          />
          <MatchOption
            selected={matchMode === 'private'}
            icon={Hash}
            title="Private Room"
            description="Buat room dengan kode unik, ajak teman."
            meta="Kode"
            onSelect={() => onMatchModeChange('private')}
          />
        </div>

        {matchMode === 'private' && (
          <div className="border-t border-rule bg-secondary/30 px-4 py-3.5">
            <label
              htmlFor="join-code"
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              <KeyRound className="h-3 w-3" />
              Punya kode dari teman?
            </label>
            <div className="mt-2 flex gap-2">
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
                className="h-11 min-w-0 flex-1 border border-border bg-card px-3 text-center font-mono text-sm uppercase tracking-[0.3em] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={onJoin}
                disabled={joinCode.length < 4}
                className="h-11 shrink-0 border border-foreground bg-foreground px-5 font-heading text-[13px] font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Gabung
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Atau buat room baru lewat tombol di layar.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

const STEPS = [
  {
    title: 'Pilih mode',
    body: 'Tentukan mode permainan dan cara matching.',
  },
  {
    title: 'Cari partner',
    body: 'Sistem mencarikan siswa lain dengan level ±1.',
  },
  {
    title: 'Bicara 3–5 menit',
    body: 'Topik sama untuk semua peserta, lalu sesi berakhir.',
  },
]

export function HowItWorks() {
  return (
    <div className="border border-rule bg-card">
      <div className="border-b border-rule bg-secondary/50 px-4 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Cara kerja
        </h2>
      </div>
      <ol className="divide-y divide-rule">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 font-mono text-[10px] tabular-nums text-primary-deep">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <p className="font-heading text-[13px] font-bold tracking-tight text-foreground">
                {step.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
