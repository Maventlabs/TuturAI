'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, History, Loader2, Mic, Plus, Sparkles, X } from 'lucide-react'
import type { ConversationLevel } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { VoiceOrb } from '@/components/student/ai-tutor/voice-orb'
import { cn } from '@/lib/utils'
import { ConversationThread } from './conversation-thread'
import { HistorySheet } from './history-sheet'
import { LevelControl } from './level-control'
import { SessionSummaryPanel } from './session-summary-panel'
import { StarterGrid } from './starter-grid'
import { TutorMark } from './tutor-mark'
import { useConversation } from './use-conversation'
import { VoiceDock } from './voice-dock'

interface ConversationPartnerProps {
  initialLevel: ConversationLevel
  studentName: string | null
}

export function ConversationPartner({ initialLevel, studentName }: ConversationPartnerProps) {
  const conversation = useConversation(initialLevel)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  const { turns, phase, mode, summary, starting, ending, error, speakingTurnId, speechErrors } = conversation
  const hasConversation = turns.length > 0

  useEffect(() => {
    if (turns.length === 0) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length])

  const handleEnd = async () => {
    const next = await conversation.endSession()
    if (next) setSummaryOpen(true)
  }

  const handlePrimary = () => {
    if (phase === 'listening') {
      conversation.endTurn()
      return
    }
    if (phase === 'speaking') {
      conversation.interrupt()
      return
    }
    if (phase === 'processing') return
    void conversation.beginTurn()
  }

  const statusLabel =
    phase === 'listening'
      ? mode === 'hands-free'
        ? 'Mendengarkan'
        : 'Merekam'
      : phase === 'processing'
        ? 'Berpikir'
        : phase === 'speaking'
          ? 'Berbicara'
          : phase === 'error'
            ? 'Gangguan'
            : 'Siap'

  const statusTone =
    phase === 'listening' || phase === 'speaking'
      ? 'bg-primary/10 text-primary'
      : phase === 'processing'
        ? 'bg-accent/10 text-accent'
        : phase === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted text-muted-foreground'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <TutorMark />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-base font-bold tracking-tight text-foreground">TuturAI Tutor</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]',
                  statusTone,
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {studentName ? `${studentName} · ` : ''}English conversation partner
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <LevelControl value={conversation.level} onChange={conversation.setLevel} locked={Boolean(conversation.session)} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHistoryOpen(true)
              void conversation.loadHistory()
            }}
            className="gap-1.5"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Riwayat</span>
            <span className="sr-only sm:hidden">Riwayat percakapan</span>
          </Button>
          <Button variant="outline" size="sm" onClick={conversation.newSession} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sesi baru</span>
            <span className="sr-only sm:hidden">Sesi baru</span>
          </Button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs leading-relaxed text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-pretty">{error}</span>
          <button
            type="button"
            onClick={conversation.clearError}
            aria-label="Tutup pesan kesalahan"
            className="rounded p-0.5 hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {!hasConversation ? (
        <div className="space-y-4">
          <section className="rounded-2xl bg-card px-5 py-10 ring-1 ring-foreground/10 sm:px-8 sm:py-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-44 w-44 sm:h-52 sm:w-52">
                <VoiceOrb state={conversation.orbState} getLevel={conversation.getLevel} />
              </div>

              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {starting ? 'Menyiapkan tutor' : 'Siap mendengarkan'}
              </p>

              <h2 className="mt-2 max-w-md font-display text-2xl leading-snug text-balance text-foreground sm:text-[28px]">
                Practice English naturally. Learn something every conversation.
              </h2>

              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
                Bicara dalam Bahasa Inggris. TuturAI merespons seperti guru, lalu menjelaskan koreksinya dalam Bahasa
                Indonesia.
              </p>

              <Button
                size="lg"
                onClick={() => void conversation.startSession(null)}
                disabled={starting}
                className="mt-5 h-11 gap-2 px-5"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                {starting ? 'Menyiapkan…' : 'Mulai bicara'}
              </Button>
            </div>
          </section>

          <StarterGrid disabled={starting} onSelect={(topicId) => void conversation.startSession(topicId)} />

          <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span className="text-pretty">
              TuturAI mengoreksi maksimal dua hal penting per giliran supaya percakapan tetap mengalir. Menu ini tidak
              memberi skor speaking — penilaian formal ada di Speaking Practice.
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ConversationThread
            turns={turns}
            speakingTurnId={speakingTurnId}
            speechErrors={speechErrors}
            onReplay={conversation.replay}
          />
          <div ref={endRef} aria-hidden="true" />

          <VoiceDock
            phase={phase}
            orbState={conversation.orbState}
            getLevel={conversation.getLevel}
            mode={mode}
            onChangeMode={(next) => void conversation.changeMode(next)}
            onPrimary={handlePrimary}
            onInterrupt={conversation.interrupt}
            onEnd={() => void handleEnd()}
            seconds={conversation.micSeconds}
            handsFreeSpeaking={conversation.handsFreeSpeaking}
            ending={ending}
            disabled={phase === 'processing' || ending || starting}
          />
        </div>
      )}

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        items={conversation.history}
        loading={conversation.loadingHistory}
        onSelect={(sessionId) => {
          setHistoryOpen(false)
          void conversation.resumeSession(sessionId).then((next) => {
            if (next) setSummaryOpen(true)
          })
        }}
      />

      <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="sr-only">Ringkasan belajar</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {summary && (
              <SessionSummaryPanel
                summary={summary}
                onNewSession={() => {
                  setSummaryOpen(false)
                  conversation.newSession()
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
