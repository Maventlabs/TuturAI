export interface AttentionEntry {
  studentId: string
  name: string
  accuracy: number | null
  averageSpeakingScore: number | null
  reason: string
}

export function AttentionList({ items }: { items: AttentionEntry[] }) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => (
        <li key={item.studentId} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{item.name}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.reason}</p>
          </div>
          <div className="shrink-0 text-right font-mono text-[11px] tabular-nums">
            {item.accuracy !== null && <p className="text-warning">{item.accuracy}%</p>}
            {item.averageSpeakingScore !== null && (
              <p className="text-muted-foreground">{item.averageSpeakingScore}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
