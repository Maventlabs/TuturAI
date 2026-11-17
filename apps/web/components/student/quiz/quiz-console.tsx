'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuestionLevel, QuizAttemptSummary, QuizAttemptView } from '@tuturai/domain'
import { EmptyState } from '@/components/student/practice/practice-ui'
import { QuizInstructions } from '@/components/student/quiz/quiz-instructions'
import { QuizLevelSelect } from '@/components/student/quiz/quiz-level-select'
import { QuizResult } from '@/components/student/quiz/quiz-result'
import { QuizRunner } from '@/components/student/quiz/quiz-runner'

type Phase = 'loading' | 'level' | 'instructions' | 'exam' | 'result'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return payload?.error?.message ?? fallback
}

/**
 * Owns the whole quiz lifecycle. The server owns the deadline: the countdown is
 * derived from `deadlineAt` plus the clock offset measured against the server's
 * `serverNow`, so a refresh, a sleeping tab, or a changed system clock cannot
 * buy extra time.
 */
export function QuizConsole() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [attempt, setAttempt] = useState<QuizAttemptView | null>(null)
  const [history, setHistory] = useState<QuizAttemptSummary[]>([])
  const [level, setLevel] = useState<QuestionLevel | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [remainingMs, setRemainingMs] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const clockOffsetRef = useRef(0)
  const submittingRef = useRef(false)
  const expiryHandledRef = useRef(false)

  const adoptAttempt = useCallback((next: QuizAttemptView) => {
    clockOffsetRef.current = Date.parse(next.serverNow) - Date.now()
    setAttempt(next)
    setAnswers(next.answers ?? {})
    setRemainingMs(next.remainingMs)
    setPhase(next.status === 'in_progress' ? 'exam' : 'result')
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/student/quiz/attempts', { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as { data?: { history?: QuizAttemptSummary[] } }
      setHistory(payload.data?.history ?? [])
    } catch {
      // History is a convenience; a failed refresh must not disturb the exam.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/quiz/attempts', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return (await response.json()) as { data?: { active?: QuizAttemptView | null; history?: QuizAttemptSummary[] } }
      })
      .then((payload) => {
        if (cancelled) return
        setHistory(payload.data?.history ?? [])
        const active = payload.data?.active ?? null
        if (active) adoptAttempt(active)
        else setPhase('level')
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('Ujian belum dapat dimuat. Periksa koneksi lalu muat ulang halaman.')
        setPhase('level')
      })
    return () => {
      cancelled = true
    }
  }, [adoptAttempt])

  const submit = useCallback(
    async (auto = false) => {
      if (!attempt || submittingRef.current) return
      submittingRef.current = true
      setSubmitting(true)
      setSubmitError(null)
      try {
        const response = await fetch(`/api/student/quiz/attempts/${attempt.id}/submit`, { method: 'POST' })
        if (!response.ok) throw new Error(await readError(response, 'SUBMIT_FAILED'))
        const payload = (await response.json()) as { data?: QuizAttemptView }
        if (!payload.data) throw new Error('SUBMIT_FAILED')
        adoptAttempt(payload.data)
        void refreshHistory()
      } catch {
        expiryHandledRef.current = false
        setSubmitError(
          auto
            ? 'Waktu habis, tetapi hasil belum tersimpan. Muat ulang halaman untuk menyelesaikan penilaian.'
            : 'Jawaban belum tersimpan. Periksa koneksi lalu kumpulkan lagi.',
        )
      } finally {
        submittingRef.current = false
        setSubmitting(false)
      }
    },
    [adoptAttempt, attempt, refreshHistory],
  )

  useEffect(() => {
    if (phase !== 'exam' || !attempt) return
    const deadline = Date.parse(attempt.deadlineAt)

    const tick = () => {
      const remaining = Math.max(0, deadline - (Date.now() + clockOffsetRef.current))
      setRemainingMs(remaining)
      if (remaining <= 0 && !expiryHandledRef.current) {
        expiryHandledRef.current = true
        void submit(true)
      }
    }

    tick()
    const interval = window.setInterval(tick, 500)
    return () => window.clearInterval(interval)
  }, [attempt, phase, submit])

  useEffect(() => {
    if (phase !== 'exam') return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const start = useCallback(async () => {
    if (!level) return
    setStarting(true)
    setStartError(null)
    try {
      const response = await fetch('/api/student/quiz/attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level }),
      })
      if (!response.ok) throw new Error(await readError(response, 'Ujian belum dapat dimulai. Coba lagi.'))
      const payload = (await response.json()) as { data?: QuizAttemptView }
      if (!payload.data) throw new Error('Ujian belum dapat dimulai. Coba lagi.')
      expiryHandledRef.current = false
      adoptAttempt(payload.data)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Ujian belum dapat dimulai. Coba lagi.')
    } finally {
      setStarting(false)
    }
  }, [adoptAttempt, level])

  const answer = useCallback(
    async (questionId: string, option: number) => {
      if (!attempt) return
      setAnswers((current) => ({ ...current, [questionId]: option }))
      setSaveState('saving')
      try {
        const response = await fetch(`/api/student/quiz/attempts/${attempt.id}/answers`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ questionId, selectedOption: option }),
        })
        if (response.status === 409) {
          const state = await fetch(`/api/student/quiz/attempts/${attempt.id}`, { cache: 'no-store' })
          if (state.ok) {
            const payload = (await state.json()) as { data?: QuizAttemptView }
            if (payload.data) adoptAttempt(payload.data)
          }
          return
        }
        if (!response.ok) throw new Error('SAVE_FAILED')
        const payload = (await response.json()) as { data?: { remainingMs: number; savedAt: string } }
        if (payload.data) {
          clockOffsetRef.current = Date.parse(payload.data.savedAt) - Date.now()
          setRemainingMs(payload.data.remainingMs)
        }
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    },
    [adoptAttempt, attempt],
  )

  const openAttempt = useCallback(async (attemptId: string) => {
    try {
      const response = await fetch(`/api/student/quiz/attempts/${attemptId}`, { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as { data?: QuizAttemptView }
      if (payload.data) adoptAttempt(payload.data)
    } catch {
      // Opening a past attempt is optional; ignore a transient failure.
    }
  }, [adoptAttempt])

  if (phase === 'loading') {
    return (
      <div className="border border-rule bg-card px-4 py-12 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat modul ujian
      </div>
    )
  }

  if (phase === 'level') {
    return (
      <div className="space-y-4">
        {loadError ? (
          <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[12px] leading-relaxed text-destructive">
            {loadError}
          </p>
        ) : null}
        <QuizLevelSelect
          onSelect={(next) => {
            setLevel(next)
            setStartError(null)
            setPhase('instructions')
          }}
          history={history}
          onOpenAttempt={openAttempt}
          busy={starting}
        />
      </div>
    )
  }

  if (phase === 'instructions' && level) {
    return (
      <QuizInstructions
        level={level}
        onStart={start}
        onBack={() => {
          setPhase('level')
          setStartError(null)
        }}
        starting={starting}
        error={startError}
      />
    )
  }

  if (phase === 'exam' && attempt) {
    return (
      <QuizRunner
        attempt={attempt}
        answers={answers}
        remainingMs={remainingMs}
        onAnswer={answer}
        onSubmit={() => void submit(false)}
        submitting={submitting}
        saveState={saveState}
        submitError={submitError}
      />
    )
  }

  if (phase === 'result' && attempt) {
    return (
      <QuizResult
        attempt={attempt}
        onRestart={() => {
          setAttempt(null)
          setAnswers({})
          setLevel(null)
          setSaveState('idle')
          setSubmitError(null)
          expiryHandledRef.current = false
          setPhase('level')
          void refreshHistory()
        }}
      />
    )
  }

  return (
    <EmptyState
      title="Ujian tidak dapat dibuka"
      description="Sesi ujian tidak ditemukan. Muat ulang halaman untuk memulai lagi."
    />
  )
}
