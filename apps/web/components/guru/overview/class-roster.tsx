import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export interface RosterClass {
  id: string
  name: string
  status: string
  studentCount: number
  assignmentCount: number
}

export function ClassRoster({ items }: { items: RosterClass[] }) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href="/guru/kelas"
            className="group flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
                {item.name}
              </p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
                {item.status === 'active' ? 'Aktif' : 'Arsip'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-5 font-mono text-[11px] tabular-nums text-muted-foreground">
              <span>
                <span className="text-foreground">{item.studentCount}</span> siswa
              </span>
              <span>
                <span className="text-foreground">{item.assignmentCount}</span> tugas
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
