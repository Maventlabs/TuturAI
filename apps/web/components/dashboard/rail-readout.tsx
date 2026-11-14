import { cn } from '@/lib/utils'

/**
 * A single cell of the top status rail: a mono micro-label stacked over a
 * value. The rail is divided by hairlines rather than pills so the header
 * reads as one continuous instrument strip.
 */
export function RailReadout({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('flex flex-col justify-center gap-1 px-3', className)}>
      <span className="font-mono text-[9px] font-medium uppercase leading-none tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5 leading-none">{children}</span>
    </span>
  )
}

export function RailValue({
  children,
  unit,
  tone = 'default',
}: {
  children: React.ReactNode
  unit?: string
  tone?: 'default' | 'attention'
}) {
  return (
    <>
      <span
        className={cn(
          'font-mono text-[11px] font-medium tabular-nums',
          tone === 'attention' ? 'text-warning' : 'text-foreground',
        )}
      >
        {children}
      </span>
      {unit && (
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{unit}</span>
      )}
    </>
  )
}

export function RailIndicator({ tone }: { tone: 'ok' | 'warn' | 'idle' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-1.5 shrink-0',
        tone === 'ok' && 'bg-success',
        tone === 'warn' && 'bg-warning',
        tone === 'idle' && 'bg-muted-foreground/50',
      )}
    />
  )
}
