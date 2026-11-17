'use client'

import Image from 'next/image'
import { ArrowUpRight, Compass, Mountain, Sprout, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LevelOption } from '@/components/student/practice/practice-ui'

const LEVEL_ICONS: LucideIcon[] = [Sprout, Compass, Mountain]

// The plates are atmosphere, not information: the level name and its contents
// are already in the card text, so the artwork stays out of the accessible name.
const LEVEL_ART = ['/learning/level-01.webp', '/learning/level-02.webp', '/learning/level-03.webp']

/**
 * The level gate shared by every practice menu that has levels.
 *
 * Each level is a photographic plate rather than a list row: the same three
 * photographs are used across all menus so a level keeps one identity wherever
 * a student meets it. The plate carries the level number, its name, what the
 * session contains, and how much of it is already mastered.
 */
export function LevelCardGrid({
  options,
  onSelect,
  activeId,
  className,
}: {
  options: LevelOption[]
  onSelect: (id: string) => void
  activeId?: string | null
  className?: string
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3', className)}>
      {options.map((option, index) => {
        const Icon = LEVEL_ICONS[index % LEVEL_ICONS.length]
        const art = LEVEL_ART[index % LEVEL_ART.length]
        const active = option.id === activeId
        const progress = typeof option.progress === 'number' ? Math.min(1, Math.max(0, option.progress)) : null

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            disabled={option.disabled}
            aria-pressed={active}
            className={cn(
              'group relative isolate flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-sm bg-ink-deep p-5 text-left outline-none ring-1 ring-ink-foreground/10 ring-inset transition-[transform,box-shadow] duration-500 ease-out sm:aspect-4/5 lg:aspect-3/4',
              'hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(10,10,13,0.9)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0',
              active && 'ring-2 ring-primary',
              option.disabled && 'cursor-not-allowed hover:translate-y-0 hover:shadow-none',
            )}
          >
            <Image
              src={option.image ?? art}
              alt={option.imageAlt ?? ''}
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
              className={cn(
                '-z-10 object-cover grayscale transition-[filter,transform] duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0 motion-reduce:transition-none',
                option.disabled && 'opacity-70',
              )}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-primary opacity-45 mix-blend-color transition-opacity duration-700 group-hover:opacity-0 motion-reduce:transition-none"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-linear-to-t from-ink-deep via-ink-deep/55 to-transparent"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b from-ink-deep/75 to-transparent"
            />

            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[11px] leading-none tracking-[0.18em] text-ink-foreground/65">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex size-8 items-center justify-center rounded-full border border-ink-foreground/25 text-ink-foreground/80 transition-colors duration-300 group-hover:border-ink-foreground/50 group-hover:bg-ink-foreground/10 group-hover:text-ink-foreground">
                <Icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
              </span>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-accent-glow">
                {option.english}
                <span className="text-ink-foreground/45"> · </span>
                {option.count} soal
              </p>
              <h3 className="mt-2.5 text-balance font-display text-[1.5rem] leading-[1.05] tracking-[-0.01em] text-ink-foreground lg:text-[1.7rem]">
                {option.name}
              </h3>
              <p className="mt-2 text-pretty text-[12.5px] leading-relaxed text-ink-foreground/70">
                {option.disabled ? option.disabledReason : option.detail}
              </p>

              {progress !== null && !option.disabled ? (
                <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                  <span className="h-[3px] flex-1 overflow-hidden rounded-[1px] bg-ink-foreground/20">
                    <span className="block h-full bg-accent-glow" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </span>
                  <span className="font-mono text-[9px] tabular-nums leading-none text-ink-foreground/60">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-foreground/20 pt-3">
                <span className="text-[12px] font-semibold leading-none text-ink-foreground">
                  {option.disabled ? 'Belum tersedia' : (option.action ?? 'Mulai level')}
                </span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-ink-foreground/70 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-foreground motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
