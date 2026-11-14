import { cn } from '@/lib/utils'

const SEGMENTS = 20

interface SkillLedgerProps {
  items: Array<{ skill: string; score: number; attempts: number }>
  target?: number
}

export function SkillLedger({ items, target = 75 }: SkillLedgerProps) {
  const sorted = [...items].sort((left, right) => left.score - right.score)

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="space-y-4">
        {sorted.map((item) => {
          const filled = Math.round((item.score / 100) * SEGMENTS)
          const belowTarget = item.score < target
          return (
            <li key={item.skill}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] capitalize text-foreground">{item.skill}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums">
                  <span className={belowTarget ? 'text-warning' : 'text-foreground'}>{item.score}%</span>
                  <span className="ml-1.5 text-muted-foreground/60">{item.attempts}&times;</span>
                </span>
              </div>
              <div className="relative mt-2">
                <div className="flex gap-[2px]" aria-hidden>
                  {Array.from({ length: SEGMENTS }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-[7px] flex-1',
                        index < filled ? (belowTarget ? 'bg-warning' : 'bg-primary') : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
                <span
                  className="absolute -top-1 h-[15px] w-px bg-foreground/45"
                  style={{ left: `${target}%` }}
                  aria-hidden
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rule pt-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-[7px] w-2.5 bg-primary" aria-hidden />
          &ge; target
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-[7px] w-2.5 bg-warning" aria-hidden />
          &lt; target
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-[9px] w-px bg-foreground/45" aria-hidden />
          {target}%
        </span>
      </div>
    </div>
  )
}
