'use client'

import { cn } from '@/lib/utils'

/**
 * Shared instrument primitives for the six student practice screens.
 *
 * The language is a lab console: hairline rules divide zones, every readout is
 * set in mono with wide tracking, and hierarchy comes from scale and rule
 * weight rather than shadows or rounded cards.
 */

export function MonoLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Readout({
  label,
  value,
  unit,
  className,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <MonoLabel>{label}</MonoLabel>
      <span className="truncate font-mono text-[13px] font-medium leading-none tabular-nums text-foreground">
        {value}
        {unit ? (
          <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{unit}</span>
        ) : null}
      </span>
    </div>
  )
}

export function PracticeHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string
  title: string
  description?: string
  meta?: Array<{ label: string; value: React.ReactNode; unit?: string }>
}) {
  return (
    <header className="border-b border-rule pb-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <MonoLabel className="text-primary-deep">{eyebrow}</MonoLabel>
          <h1 className="mt-2.5 text-balance font-heading text-[26px] font-extrabold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[64ch] text-pretty text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {meta && meta.length > 0 ? (
          <dl className="flex shrink-0 flex-wrap items-stretch gap-x-6 gap-y-3 border-t border-rule pt-4 lg:border-t-0 lg:pt-0">
            {meta.map((item) => (
              <Readout key={item.label} label={item.label} value={item.value} unit={item.unit} />
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  )
}

export function Panel({
  children,
  className,
  tone = 'card',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'card' | 'sunken'
}) {
  return (
    <section
      className={cn(
        'rounded-sm border border-rule',
        tone === 'card' ? 'bg-card' : 'bg-secondary/50',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  label,
  right,
  className,
}: {
  label: string
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5',
        className,
      )}
    >
      <MonoLabel>{label}</MonoLabel>
      {right}
    </div>
  )
}

export type LevelOption = {
  id: string
  name: string
  english: string
  count: number
  detail: string
  disabled?: boolean
  disabledReason?: string
}

/**
 * Three level cards fanned like a physical card stack: each card is indented a
 * little further than the one above it and separated by a hairline, so the set
 * reads as one object rather than three tiles. Hovering or focusing a card
 * squares it up.
 */
export function LevelStack({
  options,
  onSelect,
  activeId,
  className,
}: {
  options: LevelOption[]
  onSelect: (id: string) => void
  activeId?: string | null
  className?: string
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      {options.map((option, index) => {
        const active = option.id === activeId
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            disabled={option.disabled}
            aria-pressed={active}
            style={{ marginLeft: `${index * 10}px` }}
            className={cn(
              'group relative flex items-center gap-4 border border-rule bg-card px-4 py-4 text-left transition-[margin,background-color,border-color] duration-200 ease-out',
              index > 0 && '-mt-px',
              'hover:ml-0 hover:border-foreground/30 focus-visible:ml-0 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
              active && 'ml-0 border-primary bg-primary/[0.04]',
              option.disabled && 'cursor-not-allowed bg-secondary/40 hover:ml-auto hover:border-rule',
            )}
          >
            <span
              className={cn(
                'font-mono text-[10px] leading-none tracking-[0.16em]',
                option.disabled ? 'text-muted-foreground/50' : 'text-muted-foreground',
              )}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  className={cn(
                    'font-heading text-[17px] font-bold leading-none tracking-[-0.01em]',
                    option.disabled ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {option.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {option.english}
                </span>
              </span>
              <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground">
                {option.disabled ? option.disabledReason : option.detail}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-foreground">
                {option.count}
                <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">item</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'font-mono text-[13px] leading-none transition-transform duration-200',
                  option.disabled ? 'text-muted-foreground/40' : 'text-muted-foreground group-hover:translate-x-0.5',
                )}
              >
                →
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export type TickState = 'pending' | 'correct' | 'wrong' | 'current'

/**
 * A row of thin ticks that doubles as the session history: each answered tick
 * carries a text mark (B for benar, S for salah) so the record never depends on
 * colour alone.
 */
export function TickRail({
  states,
  className,
  label = 'Riwayat jawaban',
}: {
  states: TickState[]
  className?: string
  label?: string
}) {
  return (
    <ol className={cn('flex items-end gap-[3px]', className)} aria-label={label}>
      {states.map((state, index) => (
        <li key={index} className="flex flex-col items-center gap-1">
          <span
            className={cn(
              'flex h-6 w-[11px] items-center justify-center rounded-[1px] font-mono text-[8px] font-semibold leading-none',
              state === 'correct' && 'bg-primary text-primary-foreground',
              state === 'wrong' && 'bg-destructive text-white',
              state === 'current' && 'bg-foreground text-background',
              state === 'pending' && 'border border-rule bg-transparent text-transparent',
            )}
          >
            {state === 'correct' ? 'B' : state === 'wrong' ? 'S' : state === 'current' ? '·' : '·'}
          </span>
        </li>
      ))}
    </ol>
  )
}

export type DimensionStatus = 'scored' | 'insufficient'

/**
 * One horizontal dimension bar. A dimension that needs audio the session never
 * captured is drawn as a dashed track with an explicit label instead of a zero
 * length bar, so a missing measurement never reads as a bad score.
 */
export function DimensionBar({
  label,
  value,
  status,
  note,
}: {
  label: string
  value: number | null
  status: DimensionStatus
  note?: string
}) {
  const scored = status === 'scored' && typeof value === 'number'
  return (
    <div className="grid grid-cols-[76px_1fr_auto] items-center gap-3">
      <MonoLabel className="truncate">{label}</MonoLabel>
      <div className="relative h-[6px] w-full overflow-hidden rounded-[1px] bg-secondary">
        {scored ? (
          <span
            className="absolute inset-y-0 left-0 bg-primary"
            style={{ width: `${Math.max(2, Math.min(100, value as number))}%` }}
          />
        ) : (
          <span className="absolute inset-0 border border-dashed border-border" />
        )}
      </div>
      <span
        className={cn(
          'w-[92px] text-right font-mono text-[10px] uppercase leading-tight tracking-[0.1em]',
          scored ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {scored ? `${Math.round(value as number)}/100` : 'Butuh bukti audio'}
      </span>
      {note ? <p className="col-span-3 -mt-1 text-[11px] leading-relaxed text-muted-foreground">{note}</p> : null}
    </div>
  )
}

export function StatusLine({
  tone = 'idle',
  children,
}: {
  tone?: 'idle' | 'live' | 'busy' | 'error'
  children: React.ReactNode
}) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-2 font-mono text-[10px] uppercase leading-none tracking-[0.16em]',
        tone === 'live' && 'text-destructive',
        tone === 'busy' && 'text-primary-deep',
        tone === 'error' && 'text-destructive',
        tone === 'idle' && 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-1.5 rounded-full',
          tone === 'live' && 'bg-destructive',
          tone === 'busy' && 'bg-primary',
          tone === 'error' && 'bg-destructive',
          tone === 'idle' && 'bg-border',
        )}
      />
      {children}
    </p>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <Panel className="px-5 py-10 text-center">
      <p className="font-heading text-[15px] font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-pretty text-[12px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Panel>
  )
}
