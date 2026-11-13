import Link from 'next/link'

interface ClassroomSpreadProps {
  items: Array<{ id: string; name: string; studentCount: number }>
}

export function ClassroomSpread({ items }: ClassroomSpreadProps) {
  const max = Math.max(...items.map((item) => item.studentCount), 1)
  const total = items.reduce((sum, item) => sum + item.studentCount, 0)

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href="/guru/kelas"
                className="truncate text-[13px] text-foreground transition-colors hover:text-primary"
              >
                {item.name}
              </Link>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
                {item.studentCount}
                <span className="ml-1 text-muted-foreground/60">siswa</span>
              </span>
            </div>
            <div className="mt-1.5 h-[3px] bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${(item.studentCount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
        {items.length} kelas &middot; {total} siswa terdaftar
      </p>
    </div>
  )
}
