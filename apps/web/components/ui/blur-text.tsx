'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BlurTextProps {
  text: string
  className?: string
  delay?: number
  stagger?: number
  duration?: number
  blur?: number
  once?: boolean
}

/** Word-by-word blur dissolve, used for supporting copy under a headline. */
export function BlurText({
  text,
  className,
  delay = 0,
  stagger = 0.03,
  duration = 0.6,
  blur = 8,
  once = true,
}: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once, margin: '-8% 0px' })
  const reduceMotion = useReducedMotion()
  const words = text.split(' ')
  const visible = inView || reduceMotion

  return (
    <span ref={ref} className={cn('inline', className)} aria-label={text}>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <motion.span
            key={`${word}-${index}`}
            className="inline-block will-change-[transform,filter]"
            initial={reduceMotion ? false : { opacity: 0, y: 10, filter: `blur(${blur}px)` }}
            animate={visible ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
            transition={{
              duration,
              delay: delay + index * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        ))}
      </span>
    </span>
  )
}

export default BlurText
