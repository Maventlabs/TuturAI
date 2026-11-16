'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CountUpProps {
  to: number
  from?: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
  startOnView?: boolean
}

const format = (value: number, decimals: number) =>
  value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

/**
 * Counts a number into place once it scrolls into view. The animated digits are
 * hidden from assistive tech and the settled value is exposed instead, so a
 * screen reader never announces a half-finished number.
 */
export function CountUp({
  to,
  from = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1400,
  className,
  startOnView = true,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(from)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let frame = 0

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = requestAnimationFrame(() => setValue(to))
      return () => cancelAnimationFrame(frame)
    }

    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(from + (to - from) * eased)
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    if (!startOnView) {
      run()
      return () => cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          run()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [to, from, duration, startOnView])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      <span aria-hidden="true">
        {prefix}
        {format(value, decimals)}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {format(to, decimals)}
        {suffix}
      </span>
    </span>
  )
}

export default CountUp
