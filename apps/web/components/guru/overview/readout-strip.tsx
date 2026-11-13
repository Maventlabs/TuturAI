import { cn } from '@/lib/utils'

export interface Readout {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: 'default' | 'attention'
}

export function ReadoutStrip({ items }: { items: Readout[] }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-4 py-4">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 flex items-baseline gap-1">
            <span
              className={cn(
                'font-mono text-[26px] font-medium leading-none tabular-nums tracking-[-0.02em]',
                item.tone === 'attention' ? 'text-warning' : 'text-foreground',
              )}
            >
              {item.value}
            </span>
            {item.unit && <span className="font-mono text-[11px] text-muted-foreground">{item.unit}</span>}
          </p>
          {item.note && (
            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
              {item.note}
            </p>
          )}
        </div>
      ))}
      {/* Fills the trailing gap so the hairline grid never shows an empty cell
          at the 2- and 3-column breakpoints. */}
      <div className="bg-card sm:block lg:hidden" aria-hidden />
    </div>
  )
}
