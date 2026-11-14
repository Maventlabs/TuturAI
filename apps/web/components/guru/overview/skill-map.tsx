interface SkillMapProps {
  items: Array<{ skill: string; score: number; attempts: number }>
  target?: number
}

export function SkillMap({ items, target = 75 }: SkillMapProps) {
  return (
    <div>
      <ul className="space-y-3.5">
        {items.map((item) => (
          <li key={item.skill}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] capitalize text-foreground">{item.skill}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                <span className="text-foreground">{item.score}%</span>
                <span className="ml-1.5 text-muted-foreground/60">{item.attempts}&times;</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-[3px] bg-muted">
              <div className="h-full bg-primary" style={{ width: `${item.score}%` }} />
              <span
                className="absolute -top-1 h-[11px] w-px bg-warning"
                style={{ left: `${target}%` }}
                aria-hidden
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="h-[9px] w-px bg-warning" aria-hidden />
        Garis target {target}%
      </p>
    </div>
  )
}
