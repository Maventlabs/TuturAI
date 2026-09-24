'use client'

import { cn } from '@/lib/utils'

interface WaveformProps {
  active: boolean
  bars?: number
  /** Real-time normalized levels (0..1). When provided, bars reflect live mic input. */
  levels?: number[]
  className?: string
}

// Audio waveform. Uses real `levels` when provided, otherwise CSS animation when `active`.
export function Waveform({ active, bars = 40, levels, className }: WaveformProps) {
  const hasLevels = Array.isArray(levels) && levels.length > 0
  const count = hasLevels ? levels.length : bars

  return (
    <div
      className={cn('flex h-16 items-center justify-center gap-1', className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => {
        if (hasLevels) {
          // Map normalized level to a pixel height between 6 and 60.
          const h = Math.max(6, Math.round(levels![i] * 60))
          return (
            <span
              key={i}
              className="w-1 rounded-full bg-primary transition-[height] duration-75"
              style={{ height: `${h}px`, opacity: active ? 1 : 0.3 }}
            />
          )
        }
        return (
          <span
            key={i}
            className={cn(
              'w-1 rounded-full bg-primary/70 transition-[height,opacity] duration-200',
              active ? 'animate-waveform' : 'h-1.5 opacity-30',
            )}
            style={
              active
                ? {
                    animationDelay: `${(i % 10) * 90}ms`,
                    animationDuration: `${700 + (i % 5) * 120}ms`,
                  }
                : undefined
            }
          />
        )
      })}
    </div>
  )
}
