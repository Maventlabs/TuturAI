'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { classroomLevelLabel } from '@tuturai/domain'
import { cn } from '@/lib/utils'
import { useClassroom } from '@/components/guru/classroom-context'

export function ClassroomHeader() {
  const { classroomId, snapshot, loading } = useClassroom()
  const pathname = usePathname()
  const base = `/guru/kelas/${classroomId}`

  const tabs = [
    { label: 'Stream', href: base },
    { label: 'Classwork', href: `${base}/classwork` },
    { label: 'People', href: `${base}/people` },
    { label: 'Grades', href: `${base}/grades` },
  ]

  const classroom = snapshot?.classroom ?? null
  const levelLabel = classroom ? classroomLevelLabel(classroom.level) : null

  return (
    <div className="sticky top-16 z-10 -mx-4 -mt-6 border-b border-border bg-background/85 backdrop-blur-xl sm:-mx-6 lg:-mx-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-1.5">
          <Link
            href="/guru/kelas"
            className="shrink-0 rounded-sm text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Kelas
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          {loading ? (
            <span className="h-3.5 w-40 animate-pulse rounded bg-secondary" aria-hidden="true" />
          ) : (
            <span className="truncate font-heading text-sm font-semibold text-foreground">
              {classroom?.name ?? 'Kelas'}
            </span>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {levelLabel && (
              <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:inline">
                {levelLabel}
              </span>
            )}
            {classroom?.status === 'archived' && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-warning">
                Diarsipkan
              </span>
            )}
          </div>
        </div>

        <nav aria-label="Bagian kelas" className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
                  active
                    ? 'border-primary font-semibold text-foreground'
                    : 'border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
