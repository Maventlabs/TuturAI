'use client'

import { useState } from 'react'
import { ArrowRight, Clock, Lightbulb, RefreshCw, Target, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DEMO_MISSIONS } from './demo-data'
import type { Mission } from './types'

interface MissionDialogProps {
  open: boolean
  mission: Mission | null
  partnerNames: string[]
  onStart: () => void
}

export function MissionDialog({ open, mission, partnerNames, onStart }: MissionDialogProps) {
  if (!mission) return null

  return (
    <Dialog open={open} onOpenChange={() => undefined} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="max-w-lg">
        <DialogHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-primary-deep">
              Misi sesi
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {mission.type}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" aria-hidden />
              3–5 menit
            </span>
          </div>
          <DialogTitle className="text-xl leading-snug">{mission.title}</DialogTitle>
          <DialogDescription>{mission.topic}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-1">
          <section className="rounded-xl bg-secondary/50 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <Target className="h-3 w-3" aria-hidden />
              Tujuan bicara
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{mission.objective}</p>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Instruksi</h3>
            <ol className="mt-2 space-y-2">
              {mission.instructions.map((instruction, index) => (
                <li key={instruction} className="flex gap-2.5">
                  <span className="mt-0.5 font-mono text-[10px] tabular-nums text-primary-deep">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] leading-relaxed text-foreground">{instruction}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <Lightbulb className="h-3 w-3" aria-hidden />
              Frasa yang bisa dipakai
            </h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {mission.talkingPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-full bg-card px-2.5 py-1 text-[11px] text-foreground ring-1 ring-rule"
                >
                  {point}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" aria-hidden />
            {partnerNames.length > 0
              ? `Misi yang sama untukmu dan ${partnerNames.join(', ')}.`
              : 'Misi yang sama untuk semua peserta.'}
          </p>
          <Button onClick={onStart} className="h-10 gap-2 px-4">
            Mulai sesi
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface MissionPanelProps {
  mission: Mission | null
  onOpen: () => void
}

export function MissionPanel({ mission, onOpen }: MissionPanelProps) {
  if (!mission) return null

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-deep">
        <Target className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Misi · {mission.type}
        </p>
        <p className="mt-0.5 truncate font-heading text-[13px] font-bold tracking-tight text-foreground">
          {mission.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{mission.objective}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Lihat misi
      </button>
    </div>
  )
}

export function FreePlayPanel() {
  const [index, setIndex] = useState(0)
  const suggestion = DEMO_MISSIONS[index % DEMO_MISSIONS.length]

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
        <Lightbulb className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Free play · tanpa misi wajib
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
          Ide topik opsional: <span className="text-muted-foreground">{suggestion.topic}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIndex((value) => value + 1)}
        className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <RefreshCw className="h-2.5 w-2.5" aria-hidden />
        Ganti
      </button>
    </div>
  )
}
