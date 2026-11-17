'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen } from 'lucide-react'
import type {
  QuestionLevel,
  ReadingAttemptSummary,
  ReadingLevelStat,
  ReadingSessionView,
} from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  EmptyState,
  MonoLabel,
  Panel,
  PanelHeader,
  type LevelOption,
} from '@/components/student/practice/practice-ui'
import { LevelCardGrid } from '@/components/student/practice/level-cards'
import { ReadingResult } from '@/components/student/reading/reading-result'
import { ReadingSession } from '@/components/student/reading/reading-session'

type Phase = 'loading' | 'level' | 'briefing' | 'session' | 'result'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const LEVEL_COPY: Record<QuestionLevel, { name: string; english: string; topic: string; brief: string }> = {
  beginner: {
    name: 'Mudah',
    english: 'Beginner',
    topic: 'Teks pendek, makna tersurat',
    brief: 'Kalimat lebih pendek dan kosakata sehari-hari, tetapi pertanyaan tetap menuntut bukti dari teks.',
  },
  intermediate: {
    name: 'Sedang',
    english: 'Intermediate',
    topic: 'Parafrase & hubungan antarparagraf',
    brief: 'Teks lebih padat dengan parafrase, rujukan antarparagraf, dan pertanyaan yang butuh interpretasi.',
  },
  advanced: {
    name: 'Sulit',
    english: 'Advanced',
    topic: 'Teks akademik & inferensi',
    brief: 'Teks akademik dengan inferensi, implied meaning, sikap penulis, dan kosakata akademik.',
  },
}

const SESSION_RULES = [
  'Dua passage, masing-masing 3–4 paragraf dan 5 pertanyaan.',
  'Kelima pertanyaan passage pertama harus terjawab sebelum passage kedua terbuka.',
  'Teks tetap terbuka selama menjawab; tidak ada batas waktu.',
  'Tipe soal mengikuti gaya IELTS: main idea, detail, inference, vocabulary in context, dan lainnya.',
  'Skor dihitung server setelah dikumpulkan, lalu pembahasan muncul per soal.',
]

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return payload?.error?.message ?? fallback
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

/**
 * Owns the reading practice lifecycle: level gate, briefing, the two-passage
 * session, and the graded result. Answers are saved per question as they are
 * chosen, so a refresh resumes the same session instead of losing the work.
 */
export function ReadingConsole() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [levels, setLevels] = useState<ReadingLevelStat[]>([])
  const [history, setHistory] = useState<ReadingAttemptSummary[]>([])
  const [session, setSession] = useState<ReadingSessionView | null>(null)
  const [level, setLevel] = useState<QuestionLevel | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const adopt = useCallback((next: ReadingSessionView) => {
    setSession(next)
    setAnswers(next.answers ?? {})
    setLevel(next.level)
    setPhase(next.status === 'in_progress' ? 'session' : 'result')
  }, [])

  const refreshOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/student/reading', { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as {
        data?: { levels?: ReadingLevelStat[]; history?: ReadingAttemptSummary[] }
      }
      setLevels(payload.data?.levels ?? [])
      setHistory(payload.data?.history ?? [])
    } catch {
      // The overview is a convenience; a failed refresh must not disturb a session.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/reading', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return (await response.json()) as {
          data?: { levels?: ReadingLevelStat[]; active?: ReadingSessionView | null; history?: ReadingAttemptSummary[] }
        }
      })
      .then((payload) => {
        if (cancelled) return
        setLevels(payload.data?.levels ?? [])
        setHistory(payload.data?.history ?? [])
        const active = payload.data?.active ?? null
        if (active) adopt(active)
        else setPhase('level')
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('Modul reading belum dapat dimuat. Periksa koneksi lalu muat ulang halaman.')
        setPhase('level')
      })
    return () => {
      cancelled = true
    }
  }, [adopt])

  const levelOptions: LevelOption[] = useMemo(
    () =>
      levels.map((stat) => {
        const copy = LEVEL_COPY[stat.level]
        const ready = stat.passages >= 2
        return {
          id: stat.level,
          name: copy.name,
          english: copy.english,
          count: stat.questions,
          detail: `${stat.passages} passage · ${stat.questions} soal · ${stat.attempts} sesi selesai`,
          disabled: !ready,
          disabledReason: 'Butuh minimal dua passage terbit untuk level ini.',
          action: 'Mulai sesi',
          progress: typeof stat.bestScore === 'number' ? stat.bestScore / 100 : undefined,
        }
      }),
    [levels],
  )

  const start = useCallback(async (nextLevel: QuestionLevel) => {
    setStarting(true)
    setStartError(null)
    try {
      const response = await fetch('/api/student/reading', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level: nextLevel }),
      })
      if (!response.ok) throw new Error(await readError(response, 'Sesi reading belum dapat dimulai. Coba lagi.'))
      const payload = (await response.json()) as { data?: ReadingSessionView }
      if (!payload.data) throw new Error('Sesi reading belum dapat dimulai. Coba lagi.')
      setSaveState('idle')
      setSubmitError(null)
      adopt(payload.data)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Sesi reading belum dapat dimulai. Coba lagi.')
    } finally {
      setStarting(false)
    }
  }, [adopt])

  const answer = useCallback(
    async (questionId: string, option: number) => {
      if (!session) return
      setAnswers((current) => ({ ...current, [questionId]: option }))
      setSaveState('saving')
      try {
        const response = await fetch(`/api/student/reading/attempts/${session.id}/answers`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ questionId, selectedOption: option }),
        })
        if (response.status === 409) {
          const state = await fetch(`/api/student/reading/attempts/${session.id}`, { cache: 'no-store' })
          if (state.ok) {
            const payload = (await state.json()) as { data?: ReadingSessionView }
            if (payload.data) adopt(payload.data)
          }
          return
        }
        if (!response.ok) throw new Error('SAVE_FAILED')
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    },
    [adopt, session],
  )

  const submit = useCallback(async () => {
    if (!session || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch(`/api/student/reading/attempts/${session.id}/submit`, { method: 'POST' })
      if (!response.ok) throw new Error(await readError(response, 'SUBMIT_FAILED'))
      const payload = (await response.json()) as { data?: ReadingSessionView }
      if (!payload.data) throw new Error('SUBMIT_FAILED')
      adopt(payload.data)
      void refreshOverview()
    } catch {
      setSubmitError('Jawaban belum tersimpan. Periksa koneksi lalu kumpulkan lagi.')
    } finally {
      setSubmitting(false)
    }
  }, [adopt, refreshOverview, session, submitting])

  const backToLevels = useCallback(() => {
    setSession(null)
    setAnswers({})
    setLevel(null)
    setSaveState('idle')
    setSubmitError(null)
    setStartError(null)
    setPhase('level')
    void refreshOverview()
  }, [refreshOverview])

  if (phase === 'loading') {
    return (
      <div className="border border-rule bg-card px-4 py-12 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat modul reading
      </div>
    )
  }

  if (phase === 'level') {
    return (
      <div className="space-y-6">
        {loadError ? (
          <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[12px] leading-relaxed text-destructive">
            {loadError}
          </p>
        ) : null}

        <div>
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <MonoLabel>Pilih level</MonoLabel>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              2 passage · 10 soal
            </span>
          </div>
          <LevelCardGrid
            options={levelOptions}
            onSelect={(id) => {
              setLevel(id as QuestionLevel)
              setStartError(null)
              setPhase('briefing')
            }}
            className="mt-4"
          />
        </div>

        <Panel>
          <PanelHeader label="Aturan sesi" />
          <ul className="divide-y divide-rule">
            {SESSION_RULES.map((rule) => (
              <li key={rule} className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
                {rule}
              </li>
            ))}
          </ul>
        </Panel>

        {history.length > 0 ? (
          <Panel>
            <PanelHeader label="Sesi terakhir" right={<MonoLabel>{history.length} tercatat</MonoLabel>} />
            <ul className="divide-y divide-rule">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {LEVEL_COPY[entry.level].english} · {formatDate(entry.startedAt)}
                    </p>
                    <p className="mt-1 text-[12px] text-foreground">
                      {entry.correct ?? 0} benar dari {entry.total} soal
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[15px] font-semibold tabular-nums',
                      (entry.score ?? 0) >= 60 ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {entry.score ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    )
  }

  if (phase === 'briefing' && level) {
    const copy = LEVEL_COPY[level]
    const stat = levels.find((entry) => entry.level === level)
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <Panel>
          <PanelHeader label="Briefing" right={<MonoLabel>{copy.english}</MonoLabel>} />
          <div className="px-5 py-6">
            <h2 className="font-heading text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
              {copy.name}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {copy.topic}. {copy.brief}
            </p>

            <dl className="mt-5 grid grid-cols-3 divide-x divide-rule border-y border-rule">
              <div className="px-3 py-3">
                <MonoLabel>Passage</MonoLabel>
                <p className="mt-1.5 font-mono text-[13px] text-foreground">2</p>
              </div>
              <div className="px-3 py-3">
                <MonoLabel>Soal</MonoLabel>
                <p className="mt-1.5 font-mono text-[13px] text-foreground">10</p>
              </div>
              <div className="px-3 py-3">
                <MonoLabel>Waktu</MonoLabel>
                <p className="mt-1.5 font-mono text-[13px] text-foreground">Bebas</p>
              </div>
            </dl>

            <ul className="mt-4 space-y-2">
              {SESSION_RULES.slice(0, 3).map((rule) => (
                <li key={rule} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  <BookOpen className="mt-0.5 size-3.5 shrink-0 text-primary-deep" aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>

            {stat && stat.bestScore !== null ? (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Skor terbaik level ini: {stat.bestScore}/100
              </p>
            ) : null}

            {startError ? (
              <p role="alert" className="mt-4 text-[12px] leading-relaxed text-destructive">
                {startError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={() => void start(level)} disabled={starting} className="gap-1.5">
                {starting ? 'Menyiapkan…' : 'Mulai sesi'}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPhase('level')
                  setStartError(null)
                }}
                disabled={starting}
              >
                Kembali
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  if (phase === 'session' && session) {
    return (
      <ReadingSession
        session={session}
        answers={answers}
        onAnswer={(questionId, option) => void answer(questionId, option)}
        onSubmit={() => void submit()}
        submitting={submitting}
        saveState={saveState}
        submitError={submitError}
      />
    )
  }

  if (phase === 'result' && session) {
    return (
      <ReadingResult
        session={session}
        onRestart={backToLevels}
        onRepeat={() => {
          const nextLevel = session.level
          backToLevels()
          void start(nextLevel)
        }}
      />
    )
  }

  return (
    <EmptyState
      title="Sesi reading tidak dapat dibuka"
      description="Sesi tidak ditemukan. Muat ulang halaman untuk memulai lagi."
    />
  )
}
