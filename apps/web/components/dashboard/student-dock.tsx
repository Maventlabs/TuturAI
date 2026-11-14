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
 * The student's primary navigation: a floating dock of five destinations with
 * Beranda anchored in the middle.
 *
 * The centre item keeps a persistent ring so the dock always reads as a
 * symmetric instrument with a fixed home, while the active destination widens
 * into a labelled pill. Everything else lives in the profile menu.
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
          const isHome = item.href === '/siswa'
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? 'page' : undefined}
              aria-label={item.label}
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,padding] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ink-foreground/60',
                isHome ? 'h-11' : 'h-10 sm:h-11',
                current
                  ? 'gap-2 bg-accent-glow px-3.5 text-ink-deep'
                  : 'text-ink-muted hover:bg-ink-foreground/10 hover:text-ink-foreground',
                !current && (isHome ? 'w-11 border border-ink-foreground/25' : 'w-10 sm:w-11'),
              )}
            >
              <Icon
                className={cn('shrink-0', isHome ? 'size-[19px]' : 'size-[18px]')}
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
