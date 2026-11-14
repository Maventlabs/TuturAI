import { cn } from '@/lib/utils'

export interface EvidenceRow {
  dimension: string
  status: 'measured' | 'insufficient'
  detail: string
}

export function EvidenceCoverage({ rows }: { rows: EvidenceRow[] }) {
  const measured = rows.filter((row) => row.status === 'measured').length

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="divide-y divide-rule">
        {rows.map((row) => (
          <li
            key={row.dimension}
            className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-[13px] text-foreground">{row.dimension}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{row.detail}</p>
            </div>
            <span
              className={cn(
                'shrink-0 font-mono text-[9px] uppercase tracking-[0.12em]',
                row.status === 'measured' ? 'text-primary' : 'text-muted-foreground/50',
              )}
            >
              {row.status === 'measured' ? 'Terukur' : 'Tanpa bukti'}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
        {measured} dari {rows.length} dimensi punya bukti
      </p>
    </div>
  )
}
