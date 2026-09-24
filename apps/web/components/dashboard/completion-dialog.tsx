'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CompletionDialogProps {
  open: boolean
  title: string
  message: string
  score: string
  detail?: string
  onClose: () => void
}

export function CompletionDialog({ open, title, message, score, detail, onClose }: CompletionDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title" className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose} aria-label="Tutup hasil">
          <X className="h-4 w-4" />
        </Button>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Aktivitas selesai</p>
        <h2 id="completion-dialog-title" className="mt-2 text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Skor</p>
          <p className="mt-1 font-mono text-4xl font-bold text-primary">{score}</p>
          {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
        </div>
        <Button className="mt-5 w-full" onClick={onClose}>Lanjutkan</Button>
      </section>
    </div>
  )
}
