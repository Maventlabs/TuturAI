'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 1200,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplay(value * eased)
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
