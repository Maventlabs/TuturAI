'use client'

import { cn } from '@/lib/utils'
import SplitText from '@/components/ui/split-text'

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
          {/* The eyebrow is inline and SplitText renders inline-block, so both
              would share one line box and the heading would overlap the label. */}
          <div>
            <MonoLabel className="text-primary-deep">{eyebrow}</MonoLabel>
          </div>
          <SplitText
            as="h1"
            text={title}
            className="mt-2.5 block text-balance font-heading text-[26px] font-extrabold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[32px]"
          />
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
  /** Overrides the shared level photograph for this option. */
  image?: string
  imageAlt?: string
  /** Footer call to action on the level plate. */
  action?: string
  /** 0–1 share of the level already completed, drawn as a hairline meter. */
  progress?: number
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
