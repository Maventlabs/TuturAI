'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CompletionReaction = 'quiz' | 'speaking' | 'assignment'

interface CompletionDialogProps {
  open: boolean
  title: string
  message: string
  score: string
  detail?: string
  reaction?: CompletionReaction
  onClose: () => void
}

const reactions: Record<CompletionReaction, number[]> = {
  quiz: [0, -12, 8, -5, 0],
  speaking: [0, -7, 5, -3, 0],
  assignment: [0, 7, -5, 3, 0],
}

export function CompletionDialog({ open, title, message, score, detail, reaction = 'quiz', onClose }: CompletionDialogProps) {
  const shouldReduceMotion = useReducedMotion()
  if (!open) return null

  const logoAnimation = shouldReduceMotion
    ? { opacity: [0.65, 1] }
    : { y: reactions[reaction], rotate: reaction === 'speaking' ? [0, -6, 5, 0] : [0, 0, 0, 0], scale: reaction === 'quiz' ? [0.75, 1.12, 0.94, 1] : [0.9, 1.04, 1] }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-dialog-title"
        initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
      >
        <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose} aria-label="Tutup hasil">
          <X className="h-4 w-4" />
        </Button>
        <motion.div
          aria-hidden="true"
          className="mb-4 flex justify-center"
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.7 }}
          animate={logoAnimation}
          transition={{ duration: shouldReduceMotion ? 0.15 : 0.72, ease: 'easeOut' }}
        >
          <Image src="/brand/logo-mark-blue.png" alt="" width={52} height={55} className="h-12 w-auto" priority />
        </motion.div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Aktivitas selesai</p>
        <h2 id="completion-dialog-title" className="mt-2 text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Skor</p>
          <p className="mt-1 font-mono text-4xl font-bold text-primary" aria-live="polite">{score}</p>
          {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
        </div>
        <Button className="mt-5 w-full" onClick={onClose}>Lanjutkan</Button>
      </motion.section>
    </div>
  )
}
