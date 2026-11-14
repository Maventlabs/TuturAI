'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ReadinessItem {
  label: string
  done: boolean
  note: string
}

const SECTIONS = [
  { id: 'identitas', label: 'Identitas' },
  { id: 'integrasi', label: 'Integrasi' },
  { id: 'notifikasi', label: 'Notifikasi' },
  { id: 'keamanan', label: 'Keamanan' },
]

export function SettingsRail({ readiness }: { readiness: ReadinessItem[] }) {
  const [active, setActive] = useState(SECTIONS[0].id)
  const done = readiness.filter((item) => item.done).length

  useEffect(() => {
    const targets = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    )
    if (targets.length === 0) return

    // The section whose heading last crossed the reading line is the active one.
    const READING_LINE = 160
    let frame = 0

    const update = () => {
      frame = 0
      let current = targets[0].id
      for (const target of targets) {
        if (target.getBoundingClientRect().top <= READING_LINE) current = target.id
      }
      setActive(current)
    }

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <aside className="border-b border-rule lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="lg:sticky lg:top-20">
        <div className="bg-ink-deep px-4 py-4 text-ink-foreground">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">Kesiapan akun</p>
          <p className="mt-2 flex items-baseline gap-1 font-mono text-[26px] leading-none tabular-nums tracking-[-0.02em]">
            {done}
            <span className="text-[13px] text-ink-muted">/{readiness.length}</span>
          </p>
          <div className="mt-3 flex gap-1" aria-hidden>
            {readiness.map((item) => (
              <span
                key={item.label}
                className={cn('h-1 flex-1', item.done ? 'bg-ink-foreground' : 'bg-ink-foreground/20')}
              />
            ))}
          </div>
          <ul className="mt-3.5 space-y-1.5">
            {readiness.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">
                  <span
                    className={cn(
                      'h-1 w-1 shrink-0 rounded-full',
                      item.done ? 'bg-ink-foreground' : 'bg-ink-foreground/30',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-foreground/60">
                  {item.note}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Bagian pengaturan" className="flex gap-1 overflow-x-auto px-2 py-2 lg:block lg:py-2.5">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? 'true' : undefined}
              className={cn(
                'flex shrink-0 items-center px-2 py-1.5 text-[13px] transition-colors lg:py-2',
                active === section.id
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}
