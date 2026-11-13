interface ErrorRankingProps {
  items: Array<{ skill: string; errors: number; attempts: number }>
}

export function ErrorRanking({ items }: ErrorRankingProps) {
  const max = Math.max(...items.map((item) => item.errors), 1)

  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.skill}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="truncate text-[13px] capitalize text-foreground">{item.skill}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">{item.errors}</span>
          </div>
          <div className="ml-6 mt-1.5 h-[3px] bg-muted">
            <div className="h-full bg-warning" style={{ width: `${(item.errors / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}
