'use client'

import type { ConversationLevel } from '@tuturai/domain'
import { cn } from '@/lib/utils'

const LEVELS: Array<{ value: ConversationLevel; label: string; title: string }> = [
  { value: 'beginner', label: 'Dasar', title: 'Kalimat pendek dan kosakata umum' },
  { value: 'intermediate', label: 'Menengah', title: 'Pertanyaan opini dan alasan singkat' },
  { value: 'advanced', label: 'Lanjut', title: 'Diskusi abstrak dan kosakata bernuansa' },
]

interface LevelControlProps {
  value: ConversationLevel
  onChange: (level: ConversationLevel) => void
  locked: boolean
}

export function LevelControl({ value, onChange, locked }: LevelControlProps) {
  return (
    <div role="group" aria-label="Level percakapan" className="flex flex-1 rounded-lg bg-muted p-0.5 sm:flex-none">
      {LEVELS.map((level) => {
        const active = level.value === value
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            disabled={locked}
            aria-pressed={active}
            title={locked ? 'Level terkunci selama sesi berlangsung' : level.title}
            className={cn(
              'flex-1 rounded-[7px] px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              locked && !active && 'opacity-50',
            )}
          >
            {level.label}
          </button>
        )
      })}
    </div>
  )
}
