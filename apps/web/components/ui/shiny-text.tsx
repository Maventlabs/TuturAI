'use client'

import { cn } from '@/lib/utils'
import './shiny-text.css'

interface ShinyTextProps {
  children: React.ReactNode
  className?: string
  speed?: number
}

/** A light sweep travelling across the glyphs. Used on small mono eyebrows. */
export function ShinyText({ children, className, speed = 5 }: ShinyTextProps) {
  return (
    <span
      className={cn('shiny-text', className)}
      style={{ '--shiny-duration': `${speed}s` } as React.CSSProperties}
    >
      {children}
    </span>
  )
}

export default ShinyText
