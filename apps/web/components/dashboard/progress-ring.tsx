'use client'

import { useEffect, useRef, useState } from 'react'

interface ProgressRingProps {
  value: number // 0-100
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  label?: string
  sublabel?: string
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = 'var(--chart-1)',
  trackColor = 'var(--secondary)',
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const [progress, setProgress] = useState(0)
  const ref = useRef<SVGSVGElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          requestAnimationFrame(() => setProgress(value))
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && (
            <span className="font-heading text-xl font-extrabold text-foreground">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[11px] text-muted-foreground">{sublabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
