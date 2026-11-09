'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Scroll reveal. The tween is only created inside a
 * `prefers-reduced-motion: no-preference` matchMedia branch, so reduced-motion
 * users get the final state with no transform ever applied.
 */
export function GSAPReveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          ref.current,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            delay,
            ease: 'power3.out',
            scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true },
          },
        )
      })
      return () => mm.revert()
    },
    { scope: ref, dependencies: [delay, y] },
  )

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/** Line-by-line stagger for display headlines. Mark each line with `data-line`. */
export function GSAPLines({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          ref.current?.querySelectorAll('[data-line]') ?? [],
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.09,
            scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
          },
        )
      })
      return () => mm.revert()
    },
    { scope: ref },
  )

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
