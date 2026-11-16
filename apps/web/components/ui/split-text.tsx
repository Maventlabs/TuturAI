'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

type SplitTextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'

interface SplitTextProps {
  text: string
  as?: SplitTextTag
  className?: string
  splitBy?: 'words' | 'chars'
  delay?: number
  stagger?: number
  duration?: number
  y?: number
  once?: boolean
}

/**
 * Masked word/character reveal. Each piece sits in an overflow-hidden box and
 * slides up into place, so the line reads as one motion instead of a fade.
 */
export function SplitText({
  text,
  as = 'span',
  className,
  splitBy = 'words',
  delay = 0,
  stagger = 0.045,
  duration = 0.7,
  y = 26,
  once = true,
}: SplitTextProps) {
  const ref = useRef<HTMLElement | null>(null)
  const inView = useInView(ref, { once, margin: '-10% 0px -6% 0px' })
  const reduceMotion = useReducedMotion()
  const Tag = as as React.ElementType

  const words = text.split(' ')
  const visible = inView || reduceMotion

  return (
    <Tag ref={ref} className={cn('inline-block', className)} aria-label={text}>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => {
          const pieces = splitBy === 'chars' ? Array.from(word) : [word]
          const offset = words
            .slice(0, wordIndex)
            .reduce((sum, previous) => sum + (splitBy === 'chars' ? previous.length : 1), 0)

          return (
            <span key={`${word}-${wordIndex}`} className="inline-flex overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom">
              {pieces.map((piece, pieceIndex) => (
                <motion.span
                  key={`${piece}-${pieceIndex}`}
                  className="inline-block will-change-transform"
                  initial={reduceMotion ? false : { y: '110%', opacity: 0 }}
                  animate={visible ? { y: 0, opacity: 1 } : undefined}
                  transition={{
                    duration,
                    delay: delay + (offset + pieceIndex) * stagger,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {piece}
                </motion.span>
              ))}
              {wordIndex < words.length - 1 && <span className="inline-block">&nbsp;</span>}
            </span>
          )
        })}
      </span>
    </Tag>
  )
}

export default SplitText
