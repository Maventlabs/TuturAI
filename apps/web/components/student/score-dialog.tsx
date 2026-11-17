'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { MonoLabel } from '@/components/student/practice/practice-ui'
import { getScoreNarrative, type ScoreNarrative } from '@/lib/completion'

interface ScoreDialogProps {
  open: boolean
  /** Where the session came from, e.g. "Kuis kosakata selesai". */
  eyebrow: string
  /** 0–100. Pass null for a completion that has no numeric score. */
  score: number | null
  /** Shown instead of the number when score is null, e.g. "Terkirim". */
  scoreLabel?: string
  /** Short mono readout beside the score, e.g. "18 benar · 2 salah". */
  detail?: string
  /** Overrides the score-band narrative when a screen needs its own wording. */
  narrative?: ScoreNarrative
  onClose: () => void
}

export function ScoreDialog({ open, eyebrow, score, scoreLabel, detail, narrative, onClose }: ScoreDialogProps) {
  const shouldReduceMotion = useReducedMotion()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  const hasScore = typeof score === 'number' && Number.isFinite(score)
  const value = hasScore ? Math.max(0, Math.min(100, Math.round(score as number))) : 0
  const summary = narrative ?? getScoreNarrative(value)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-dialog-title"
        aria-describedby="score-dialog-message"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: 'easeOut' }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-sm border border-rule bg-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/logo-mark-blue.png" alt="" width={22} height={23} className="h-[22px] w-auto" priority />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground">TuturAI</span>
          </div>
          <MonoLabel className="truncate text-right">{eyebrow}</MonoLabel>
        </div>

        <div className="px-5 pb-5 pt-5">
          <h2
            id="score-dialog-title"
            className="text-balance font-heading text-[26px] font-extrabold leading-[1.1] tracking-[-0.025em] text-foreground"
          >
            {summary.title}
          </h2>
          <p id="score-dialog-message" className="mt-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">
            {summary.message}
          </p>

          <div className="mt-5 border-y border-rule py-4">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <MonoLabel>Skor</MonoLabel>
                <p className="mt-2 font-mono text-[44px] font-semibold leading-none tabular-nums text-foreground" aria-live="polite">
                  {hasScore ? value : (scoreLabel ?? '—')}
                  {hasScore ? (
                    <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
                  ) : null}
                </p>
              </div>
              {detail ? (
                <p className="max-w-[46%] text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground">
                  {detail}
                </p>
              ) : null}
            </div>
            {hasScore ? (
              <div className="mt-3 h-[3px] w-full overflow-hidden rounded-[1px] bg-secondary" aria-hidden="true">
                <motion.span
                  className="block h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, value)}%` }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: 'easeOut', delay: shouldReduceMotion ? 0 : 0.12 }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-rule px-5 py-4">
          <Button className="w-full" onClick={onClose} autoFocus>
            Lanjutkan
          </Button>
        </div>
      </motion.section>
    </div>
  )
}
