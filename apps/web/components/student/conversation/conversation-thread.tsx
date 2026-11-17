'use client'

import { memo } from 'react'
import { Play, RotateCcw, Volume2 } from 'lucide-react'
import type { ConversationVocabularyNote } from '@tuturai/domain'
import { cn } from '@/lib/utils'
import { CorrectionCard } from './correction-card'
import { TutorMark } from './tutor-mark'
import type { ConversationTurnView } from './use-conversation'

interface ConversationThreadProps {
  turns: ConversationTurnView[]
  speakingTurnId: string | null
  speechErrors: Record<string, boolean>
  onReplay: (turnId: string, text: string) => void
}

function VocabularyNotes({ notes }: { notes: ConversationVocabularyNote[] }) {
  if (notes.length === 0) return null

  return (
    <dl className="mt-3 space-y-2 border-l-2 border-rule pl-3">
      {notes.map((note) => (
        <div key={note.phrase}>
          <dt className="text-xs font-semibold text-foreground">{note.phrase}</dt>
          <dd className="text-xs leading-relaxed text-muted-foreground">
            {note.meaning}
            {note.example ? <span className="text-muted-foreground/80"> — {note.example}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function StudentTurn({ turn }: { turn: ConversationTurnView }) {
  return (
    <li className="flex flex-col items-end gap-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Kamu</p>
      <p className="max-w-[88%] rounded-2xl rounded-br-sm bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground text-pretty">
        {turn.transcript}
      </p>
    </li>
  )
}

function TutorTurn({
  turn,
  speaking,
  speechFailed,
  onReplay,
}: {
  turn: ConversationTurnView
  speaking: boolean
  speechFailed: boolean
  onReplay: (turnId: string, text: string) => void
}) {
  return (
    <li className="flex gap-3">
      <TutorMark size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">Tutor</p>
          <button
            type="button"
            onClick={() => onReplay(turn.id, turn.transcript)}
            aria-label={speechFailed ? 'Coba buat suara tutor lagi' : 'Putar ulang balasan tutor'}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              speechFailed && 'text-destructive hover:text-destructive',
            )}
          >
            {speaking ? (
              <Volume2 className="h-3.5 w-3.5 animate-pulse" />
            ) : speechFailed ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          {speechFailed && <span className="text-[10px] text-destructive">Suara gagal dibuat</span>}
        </div>

        <p className="mt-1 font-display text-[17px] leading-relaxed text-foreground text-pretty">{turn.transcript}</p>

        <CorrectionCard corrections={turn.corrections} />
        <VocabularyNotes notes={turn.vocabularyNotes} />
      </div>
    </li>
  )
}

export const ConversationThread = memo(function ConversationThread({
  turns,
  speakingTurnId,
  speechErrors,
  onReplay,
}: ConversationThreadProps) {
  return (
    <ol className="space-y-6">
      {turns.map((turn) =>
        turn.speaker === 'student' ? (
          <StudentTurn key={turn.id} turn={turn} />
        ) : (
          <TutorTurn
            key={turn.id}
            turn={turn}
            speaking={speakingTurnId === turn.id}
            speechFailed={Boolean(speechErrors[turn.id])}
            onReplay={onReplay}
          />
        ),
      )}
    </ol>
  )
})
