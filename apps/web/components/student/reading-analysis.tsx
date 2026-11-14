'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  EmptyState,
  LevelStack,
  MonoLabel,
  Panel,
  PanelHeader,
  type LevelOption,
} from '@/components/student/practice/practice-ui'

type LevelId = 'beginner' | 'intermediate' | 'advanced'
type Phase = 'levels' | 'work' | 'deck' | 'result'

const LEVELS: Array<{ id: LevelId; name: string; english: string }> = [
  { id: 'beginner', name: 'Mudah', english: 'Beginner' },
  { id: 'intermediate', name: 'Sedang', english: 'Intermediate' },
  { id: 'advanced', name: 'Sulit', english: 'Advanced' },
]

type Result = { isCorrect: boolean; correctOption: number | null }

export function ReadingAnalysis() {
  const [banks, setBanks] = useState<Record<LevelId, QuestionBankItem[]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId | null>(null)
  const [phase, setPhase] = useState<Phase>('levels')
  const [cursor, setCursor] = useState(0)
  const [answers, setAnswers] = useState<Array<number | null>>([])
  const [highlighted, setHighlighted] = useState<Record<string, number[]>>({})
  const [results, setResults] = useState<Result[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    Promise.all(
      LEVELS.map((entry) =>
        fetch(`/api/student/question-bank?skill=reading&level=${entry.id}&limit=20`, { cache: 'no-store' }).then(
          async (response) => {
            if (!response.ok) throw new Error('LOAD_FAILED')
            return (await response.json()) as { data?: QuestionBankItem[] }
          },
        ),
      ),
    )
      .then((payloads) => {
        const next = {} as Record<LevelId, QuestionBankItem[]>
        LEVELS.forEach((entry, index) => {
          next[entry.id] = (payloads[index].data ?? []).filter((item) => item.options.length >= 2)
        })
        setBanks(next)
      })
      .catch(() => setError('Bank bacaan belum dapat dimuat. Coba lagi nanti.'))
  }, [])

  const items = level && banks ? banks[level] : []
  const current = items[cursor] ?? null
  const sentences = useMemo(() => (current ? current.prompt.split(/(?<=[.!?])\s+/) : []), [current])
  const activeHighlights = current ? highlighted[current.id] ?? [] : []

  function startLevel(id: string) {
    const next = id as LevelId
    if (!banks || banks[next].length === 0) return
    setLevel(next)
    setCursor(0)
    setAnswers(banks[next].map(() => null))
    setResults(null)
    setSubmitError(null)
    setPhase('work')
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const collected: Result[] = []
      for (let index = 0; index < items.length; index += 1) {
        const response = await fetch('/api/student/question-bank', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            questionId: items[index].id,
            selectedOption: answers[index],
            attemptId: crypto.randomUUID(),
          }),
        })
        if (!response.ok) throw new Error('SUBMIT_FAILED')
        const payload = (await response.json()) as { data?: { isCorrect?: boolean; correctOption?: number } }
        if (!payload.data) throw new Error('SUBMIT_FAILED')
        collected.push({ isCorrect: payload.data.isCorrect === true, correctOption: payload.data.correctOption ?? null })
      }
      setResults(collected)
      setCursor(0)
      setFlipped(false)
      setPhase('deck')
    } catch {
      setSubmitError('Jawaban belum tersimpan sepenuhnya. Periksa koneksi lalu coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <EmptyState title="Bacaan tidak tersedia" description={error} />

  if (!banks) {
    return (
      <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat bank bacaan
      </div>
    )
  }

  if (phase === 'levels') {
    const options: LevelOption[] = LEVELS.map((entry) => {
      const count = banks[entry.id].length
      return {
        id: entry.id,
        name: entry.name,
        english: entry.english,
        count,
        detail: count === 0 ? 'Belum ada bacaan pada level ini.' : `${count} teks pendek dengan pertanyaan pemahaman.`,
        disabled: count === 0,
        disabledReason: 'Belum ada bacaan yang dipublikasikan untuk level ini.',
      }
    })
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <MonoLabel>Pilih level</MonoLabel>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Baca · tandai · jawab
            </span>
          </div>
          <LevelStack options={options} onSelect={startLevel} className="mt-4" />
        </div>
        <aside>
          <Panel>
            <PanelHeader label="Cara kerja" />
            <ol className="divide-y divide-rule">
              {[
                'Teks tampil di kolom kiri dengan lebar baca nyaman.',
                'Klik satu kalimat untuk menandainya sebagai bukti.',
                'Jawab pertanyaan di kolom kanan tanpa pindah halaman.',
                'Setelah dikumpulkan, pertanyaan berubah menjadi kartu balik.',
              ].map((step, index) => (
                <li key={step} className="flex gap-3 px-4 py-3">
                  <span className="font-mono text-[10px] leading-5 text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[12px] leading-relaxed text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    )
  }

  if (phase === 'work' && current) {
    const answeredCount = answers.filter((value) => value !== null).length
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-rule pb-3">
            <MonoLabel>Teks</MonoLabel>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {activeHighlights.length} kalimat ditandai
            </span>
          </div>
          <div className="max-w-[66ch] pt-5">
            <p className="text-[16px] leading-[1.75] text-foreground">
              {sentences.map((sentence, index) => {
                const active = activeHighlights.includes(index)
                return (
                  <button
                    key={`${sentence}-${index}`}
                    type="button"
                    onClick={() =>
                      setHighlighted((state) => {
                        const list = state[current.id] ?? []
                        return {
                          ...state,
                          [current.id]: list.includes(index)
                            ? list.filter((value) => value !== index)
                            : [...list, index],
                        }
                      })
                    }
                    aria-pressed={active}
                    className={cn(
                      'cursor-pointer rounded-[2px] text-left transition-colors',
                      active ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary',
                    )}
                  >
                    {sentence}{' '}
                  </button>
                )
              })}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader
              label="Pertanyaan"
              right={
                <MonoLabel>
                  {cursor + 1}/{items.length}
                </MonoLabel>
              }
            />
            <div className="flex flex-wrap gap-1 border-b border-rule px-3 py-2">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCursor(index)}
                  aria-current={index === cursor ? 'true' : undefined}
                  className={cn(
                    'flex size-7 items-center justify-center font-mono text-[10px] tabular-nums transition-colors',
                    answers[index] !== null
                      ? 'bg-foreground text-background'
                      : 'border border-rule text-muted-foreground hover:border-foreground/40',
                    index === cursor && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="space-y-2 p-3">
              {current.options.map((option, index) => {
                const selected = answers[cursor] === index
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setAnswers((values) => values.map((value, position) => (position === cursor ? index : value)))
                    }
                    aria-pressed={selected}
                    className={cn(
                      'flex w-full items-center gap-2.5 border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/[0.05]'
                        : 'border-rule bg-card hover:border-foreground/30',
                    )}
                  >
                    <span className="font-mono text-[10px] leading-none text-muted-foreground">{index + 1}</span>
                    <span className="flex-1 text-[13px] leading-relaxed text-foreground">{option}</span>
                  </button>
                )
              })}
            </div>
          </Panel>

          {submitError ? (
            <p role="alert" className="text-[12px] leading-relaxed text-destructive">
              {submitError}
            </p>
          ) : null}

          <Button
            className="w-full"
            onClick={submit}
            disabled={submitting || answeredCount === 0}
          >
            {submitting ? 'Menyimpan…' : `Kumpulkan (${answeredCount}/${items.length})`}
          </Button>
        </aside>
      </div>
    )
  }

  if (phase === 'deck' && results && current) {
    const entry = results[cursor]
    const chosen = answers[cursor]
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-3">
          <MonoLabel>
            Kartu {cursor + 1} / {items.length}
          </MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Klik untuk membalik
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={flipped ? 'Lihat pertanyaan' : 'Lihat jawaban'}
          className="mt-5 block w-full [perspective:1400px]"
        >
          <div
            className={cn(
              'relative min-h-[260px] w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none',
              flipped && '[transform:rotateY(180deg)]',
            )}
          >
            <div className="absolute inset-0 flex flex-col justify-between border border-rule bg-card p-5 text-left [backface-visibility:hidden]">
              <MonoLabel>Pertanyaan</MonoLabel>
              <p className="text-pretty text-[16px] leading-[1.65] text-foreground">{current.prompt}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Jawabanmu: {chosen === null ? '—' : current.options[chosen]}
              </p>
            </div>
            <div className="absolute inset-0 flex flex-col justify-between border border-rule bg-secondary/60 p-5 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="flex items-center gap-2">
                {entry.isCorrect ? (
                  <Check className="size-3.5 text-success" aria-hidden="true" />
                ) : (
                  <X className="size-3.5 text-destructive" aria-hidden="true" />
                )}
                <MonoLabel>{entry.isCorrect ? 'Benar' : 'Salah'}</MonoLabel>
              </div>
              <div>
                <p className="text-[15px] leading-relaxed text-foreground">
                  {entry.correctOption === null ? '—' : current.options[entry.correctOption]}
                </p>
                {current.explanation ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{current.explanation}</p>
                ) : null}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Kunci jawaban
              </p>
            </div>
          </div>
        </button>

        <div className="mt-5 flex items-center justify-between border-t border-rule pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCursor((value) => Math.max(0, value - 1))
              setFlipped(false)
            }}
            disabled={cursor === 0}
          >
            Sebelumnya
          </Button>
          {cursor + 1 >= items.length ? (
            <Button size="sm" onClick={() => setPhase('result')} className="gap-1.5">
              Lihat hasil <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setCursor((value) => value + 1)
                setFlipped(false)
              }}
              className="gap-1.5"
            >
              Kartu berikutnya <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'result' && results) {
    const correct = results.filter((entry) => entry.isCorrect).length
    const score = results.length === 0 ? 0 : Math.round((correct / results.length) * 100)
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-5">
          <div>
            <MonoLabel>Skor analisis</MonoLabel>
            <p className="mt-2 font-mono text-[52px] font-semibold leading-none tabular-nums text-foreground">
              {score}
              <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
            </p>
          </div>
          <p className="text-right font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
            {correct} benar
            <br />
            {results.length - correct} salah
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAnswers(items.map(() => null))
              setResults(null)
              setCursor(0)
              setPhase('work')
            }}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" /> Ulangi
          </Button>
          <Button variant="ghost" onClick={() => setPhase('levels')}>
            Pilih level lain
          </Button>
        </div>
      </div>
    )
  }

  return null
}
