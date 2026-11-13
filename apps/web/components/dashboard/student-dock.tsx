'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { studentDockNav } from '@/lib/navigation'
import { cn } from '@/lib/utils'

function isCurrent(pathname: string, href: string) {
  if (href === '/siswa') return pathname === '/siswa'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The student's primary navigation: a floating dock of five destinations.
 *
 * The active destination widens into a labelled pill while the rest stay as
 * icon wells, so the dock always shows where you are without spending a row of
 * text on every item. The remaining student routes live in the menu sheet.
 */
export function StudentDock() {
  const pathname = usePathname()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <nav
        aria-label="Navigasi utama siswa"
        className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-ink-deep p-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] ring-1 ring-ink-foreground/10 sm:gap-1"
      >
        {studentDockNav.map((item) => {
          const current = isCurrent(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex h-10 shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,padding] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ink-foreground/60 sm:h-11',
                current
                  ? 'gap-2 bg-accent-glow px-3.5 text-ink-deep'
                  : 'w-10 text-ink-muted hover:bg-ink-foreground/10 hover:text-ink-foreground sm:w-11',
              )}
            >
              <Icon
                className="size-[18px] shrink-0"
                strokeWidth={current ? 2.1 : 1.7}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap text-[12px] font-semibold leading-none transition-all duration-300 ease-out',
                  current ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0',
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
