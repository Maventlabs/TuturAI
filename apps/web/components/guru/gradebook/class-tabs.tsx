'use client'

import { cn } from '@/lib/utils'

interface ClassTabsProps {
  classrooms: Array<{ id: string; name: string; studentCount: number }>
  activeId: string | null
  onSelect: (id: string) => void
}

export function ClassTabs({ classrooms, activeId, onSelect }: ClassTabsProps) {
  if (classrooms.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Pilih kelas"
      className="inline-flex max-w-full items-stretch gap-px overflow-x-auto bg-rule"
    >
      {classrooms.map((classroom) => {
        const active = classroom.id === activeId
        return (
          <button
            key={classroom.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(classroom.id)}
            className={cn(
              'flex shrink-0 items-baseline gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="max-w-[260px] truncate">{classroom.name}</span>
            <span className={cn('tabular-nums', active ? 'text-background/60' : 'text-muted-foreground/50')}>
              {classroom.studentCount}
            </span>
          </button>
        )
      })}
    </div>
  )
}
