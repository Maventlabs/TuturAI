'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface RevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}

/**
 * GSAP reveal wrapper — animates children in when they enter viewport.
 * Honors prefers-reduced-motion (shows content instantly).
 */
export function GSAPReveal({ children, className, delay = 0, y = 28 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      gsap.set(el, { clearProps: 'all', opacity: 1, y: 0 })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
        },
      )
    }, ref)
    return () => ctx.revert()
  }, [delay, y])

  return <div ref={ref} className={className}>{children}</div>
}

/**
 * Headline word/line stagger for H1/H2.
 */
export function GSAPLines({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const ctx = gsap.context(() => {
      const items = el.querySelectorAll('[data-line]')
      gsap.fromTo(
        items,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.09,
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          },
        },
      )
    }, ref)
    return () => ctx.revert()
  }, [])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
