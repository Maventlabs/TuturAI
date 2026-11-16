'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { studentDockNav } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const MotionLink = motion.create(Link)

function isCurrent(pathname: string, href: string) {
  if (href === '/siswa') return pathname === '/siswa'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The student's primary navigation: a floating blue dock of five destinations
 * with Beranda anchored in the middle.
 *
 * The centre item keeps a persistent ring so the dock always reads as a
 * symmetric instrument with a fixed home, while the active destination widens
 * into a labelled pill. Everything else lives in the profile menu.
 */
export function StudentDock() {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <nav
        aria-label="Navigasi utama siswa"
        className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-dock p-1.5 shadow-[0_18px_40px_-14px_rgba(47,109,245,0.7),inset_0_1px_0_0_rgba(255,255,255,0.22)] ring-1 ring-dock-foreground/20 sm:gap-1"
      >
        {studentDockNav.map((item) => {
          const current = isCurrent(pathname, item.href)
          const isHome = item.href === '/siswa'
          const Icon = item.icon

          return (
            <MotionLink
              key={item.href}
              href={item.href}
              aria-current={current ? 'page' : undefined}
              aria-label={item.label}
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.06 }}
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={cn(
                'group relative flex shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,padding] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-dock-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-dock',
                isHome ? 'h-11' : 'h-10 sm:h-11',
                current
                  ? 'gap-2 bg-dock-foreground px-3.5 text-dock'
                  : 'text-dock-foreground hover:bg-dock-foreground/15',
                !current && (isHome ? 'w-11 border border-dock-foreground/40' : 'w-10 sm:w-11'),
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
              {!current && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-deep px-2 py-1 text-[11px] font-medium leading-none text-ink-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 sm:block"
                >
                  {item.label}
                </span>
              )}
            </MotionLink>
          )
        })}
      </nav>
    </div>
  )
}
