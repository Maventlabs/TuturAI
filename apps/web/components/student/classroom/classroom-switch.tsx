'use client'

import type { Classroom } from '@tuturai/domain'
import { cn } from '@/lib/utils'

interface ClassroomSwitchProps {
  classrooms: Classroom[]
  value: string
  onChange: (classroomId: string) => void
}

/**
 * A segmented switch rather than a select: the student usually belongs to two
 * or three classrooms, and seeing them side by side makes the active one
 * obvious without opening a menu.
 */
export function ClassroomSwitch({ classrooms, value, onChange }: ClassroomSwitchProps) {
  if (classrooms.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Pilih classroom"
      className="flex max-w-full items-center gap-px overflow-x-auto bg-rule"
    >
      {classrooms.map((classroom) => (
        <button
          key={classroom.id}
          type="button"
          onClick={() => onChange(classroom.id)}
          aria-pressed={value === classroom.id}
          className={cn(
            'shrink-0 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
            value === classroom.id
              ? 'bg-foreground text-background'
              : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {classroom.name}
        </button>
      ))}
    </div>
  )
}
