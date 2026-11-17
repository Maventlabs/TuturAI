'use client'

import { ArrowRight, Clock, RotateCcw, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatClock } from './format'
import { GAME_MODEL_LABEL, MATCH_MODE_LABEL, type GameModel, type MatchMode, type Mission } from './types'

interface SessionSummaryProps {
  durationSeconds: number
  matchMode: MatchMode
  gameModel: GameModel
  mission: Mission | null
  participantNames: string[]
  onReturn: () => void
  onSearchAgain: () => void
}

export function SessionSummary({
  durationSeconds,
  matchMode,
  gameModel,
  mission,
  participantNames,
  onReturn,
  onSearchAgain,
}: SessionSummaryProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ringkasan sesi</p>
          <h2 className="mt-0.5 font-heading text-base font-bold tracking-tight text-foreground">Sesi selesai</h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {MATCH_MODE_LABEL[matchMode]} · {GAME_MODEL_LABEL[gameModel]}
        </span>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-rule border-b border-rule sm:grid-cols-4">
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Durasi</dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{formatClock(durationSeconds)}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Peserta</dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{participantNames.length + 1}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Mode</dt>
          <dd className="mt-0.5 truncate text-[12px] text-foreground">
            {gameModel === 'instruction' ? 'Instruksi' : 'Free play'}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Status</dt>
          <dd className="mt-0.5 text-[12px] text-foreground">Selesai</dd>
        </div>
      </dl>

      <div className="space-y-3 px-4 py-3">
        {mission && (
          <div className="rounded-xl bg-secondary/50 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Misi · {mission.type}
            </p>
            <p className="mt-0.5 font-heading text-[13px] font-bold tracking-tight text-foreground">{mission.title}</p>
          </div>
        )}

        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            Kamu{participantNames.length > 0 ? ` · ${participantNames.join(' · ')}` : ''}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
              Sesi selesai
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[11px] tabular-nums text-foreground">+25 XP</span>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-warning">
                Menunggu server
              </span>
            </span>
          </div>
          {mission && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
                Bonus misi
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] tabular-nums text-foreground">+10 XP</span>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-warning">
                  Menunggu server
                </span>
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          XP dan badge diberikan oleh server setelah sesi diverifikasi. Mode pratinjau tidak mengirim klaim XP.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-rule px-4 py-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onReturn} className="h-10 gap-2">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Kembali ke lobby
        </Button>
        <Button onClick={onSearchAgain} className="h-10 gap-2">
          Cari partner lagi
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </section>
  )
}
