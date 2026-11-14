'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  TickRail,
  type LevelOption,
  type TickState,
} from '@/components/student/practice/practice-ui'

type LevelId = 'beginner' | 'intermediate' | 'advanced'

const LEVELS: Array<{ id: LevelId; name: string; english: string }> = [
  { id: 'beginner', name: 'Mudah', english: 'Beginner' },
  { id: 'intermediate', name: 'Sedang', english: 'Intermediate' },
  { id: 'advanced', name: 'Sulit', english: 'Advanced' },
]

type Answer = { questionId: string; correct: boolean; chosen: string }

function shuffle<T>(items: T[], seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 2147483647
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    hash = (hash * 1103515245 + 12345) % 2147483647
    const swap = hash % (index + 1)
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

export function VocabularyQuiz() {
  const [banks, setBanks] = useState<Record<LevelId, QuestionBankItem[]> | null>(null)
  const [mastered, setMastered] = useState<Record<LevelId, string[]>>({
    beginner: [],
    intermediate: [],
    advanced: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId | null>(null)
  const [order, setOrder] = useState<QuestionBankItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [chosen, setChosen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    Promise.all(
      LEVELS.map((entry) =>
        fetch(`/api/student/question-bank?type=vocabulary&level=${entry.id}&limit=20`, { cache: 'no-store' }).then(
          async (response) => {
            if (!response.ok) throw new Error('LOAD_FAILED')
            return (await response.json()) as { data?: QuestionBankItem[]; masteredIds?: string[] }
          },
        ),
      ),
    )
      .then((results) => {
        const nextBanks = {} as Record<LevelId, QuestionBankItem[]>
        const nextMastered = {} as Record<LevelId, string[]>
        LEVELS.forEach((entry, index) => {
          const cards = (results[index].data ?? []).filter((item) => Boolean(item.word) && Boolean(item.meaning))
          nextBanks[entry.id] = cards
          nextMastered[entry.id] = results[index].masteredIds ?? []
        })
        setBanks(nextBanks)
        setMastered(nextMastered)
      })
      .catch(() => setError('Bank kosakata belum dapat dimuat. Coba lagi nanti.'))
  }, [])

  const word = order[cursor] ?? null

  const options = useMemo(() => {
    if (!word || !banks) return []
    const pool = LEVELS.flatMap((entry) => banks[entry.id])
      .filter((item) => item.id !== word.id && item.meaning && item.meaning !== word.meaning)
      .map((item) => item.meaning as string)
    const distractors = shuffle([...new Set(pool)], word.id).slice(0, 3)
    return shuffle([word.meaning as string, ...distractors], `${word.id}-options`)
  }, [word, banks])

  const startLevel = useCallback(
    (id: LevelId) => {
      if (!banks) return
      const cards = banks[id]
      if (cards.length === 0) return
      setLevel(id)
      setOrder(cards)
      setCursor(0)
      setAnswers([])
      setChosen(null)
      setSaveError(null)
      setFinished(false)
    },
    [banks],
  )

  const recordMastery = useCallback(async (questionId: string) => {
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch('/api/student/question-bank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId, selectedOption: 0, attemptId: crypto.randomUUID() }),
      })
      const payload = (await response.json()) as { data?: { isCorrect?: boolean } }
      if (!response.ok || payload.data?.isCorrect !== true) throw new Error('MASTERY_NOT_CONFIRMED')
      setMastered((current) => {
        if (!level) return current
        const ids = current[level]
        return ids.includes(questionId) ? current : { ...current, [level]: [...ids, questionId] }
      })
    } catch {
      setSaveError('Progres belum tersimpan. Coba lagi saat koneksi tersedia.')
    } finally {
      setSaving(false)
    }
  }, [level])

  const answer = useCallback(
    (option: string) => {
      if (!word || chosen) return
      const correct = option === word.meaning
      setChosen(option)
      setAnswers((current) => [...current, { questionId: word.id, correct, chosen: option }])
      if (correct) void recordMastery(word.id)
    },
    [word, chosen, recordMastery],
  )

  const advance = useCallback(() => {
    if (!chosen) return
    if (cursor + 1 >= order.length) {
      setFinished(true)
      return
    }
    setCursor((value) => value + 1)
    setChosen(null)
  }, [chosen, cursor, order.length])

  useEffect(() => {
    if (!word || finished) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (!chosen && ['1', '2', '3', '4'].includes(event.key)) {
        const option = options[Number(event.key) - 1]
        if (option) {
          event.preventDefault()
          answer(option)
        }
        return
      }
      if (chosen && event.key === 'Enter') {
        event.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [word, finished, chosen, options, answer, advance])

  if (error) return <EmptyState title="Kosakata tidak tersedia" description={error} />

  if (!banks) {
    return (
      <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat bank kosakata
      </div>
    )
  }

  if (!level) {
    const levelOptions: LevelOption[] = LEVELS.map((entry) => {
      const cards = banks[entry.id]
      const masteredCount = cards.filter((card) => mastered[entry.id].includes(card.id)).length
      return {
        id: entry.id,
        name: entry.name,
        english: entry.english,
        count: cards.length,
        detail:
          cards.length === 0
            ? 'Belum ada kartu pada level ini.'
            : `${masteredCount} dari ${cards.length} kata sudah dikuasai.`,
        disabled: cards.length === 0,
        disabledReason: 'Belum ada kartu kosakata yang dipublikasikan untuk level ini.',
      }
    })

    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <MonoLabel>Pilih level</MonoLabel>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              20 kata per sesi
            </span>
          </div>
          <LevelStack options={levelOptions} onSelect={(id) => startLevel(id as LevelId)} className="mt-4" />
        </div>
        <aside className="space-y-4">
          <Panel>
            <PanelHeader label="Cara kerja" />
            <ol className="divide-y divide-rule">
              {[
                'Satu kata tampil besar di layar.',
                'Pilih arti yang benar dari empat opsi, atau tekan 1–4.',
                'Umpan balik muncul langsung dengan contoh kalimat.',
                'Jawaban benar dicatat server sebagai kata dikuasai.',
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

  const correctCount = answers.filter((entry) => entry.correct).length
  const tickStates: TickState[] = order.map((_, index) => {
    if (index < answers.length) return answers[index].correct ? 'correct' : 'wrong'
    return index === cursor && !finished ? 'current' : 'pending'
  })

  if (finished) {
    const wrong = answers.filter((entry) => !entry.correct)
    const right = answers.filter((entry) => entry.correct)
    const score = order.length === 0 ? 0 : Math.round((correctCount / order.length) * 100)
    return (
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-5">
          <div>
            <MonoLabel>Hasil sesi</MonoLabel>
            <p className="mt-2 font-mono text-[52px] font-semibold leading-none tabular-nums text-foreground">
              {score}
              <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
            </p>
          </div>
          <p className="text-right font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
            {correctCount} benar
            <br />
            {wrong.length} salah
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Panel>
            <PanelHeader label={`Benar — ${right.length}`} />
            <ul className="divide-y divide-rule">
              {right.length === 0 ? (
                <li className="px-4 py-3 text-[12px] text-muted-foreground">Belum ada jawaban benar.</li>
              ) : (
                right.map((entry) => {
                  const card = order.find((item) => item.id === entry.questionId)
                  return (
                    <li key={entry.questionId} className="flex items-center gap-2 px-4 py-2.5">
                      <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                      <span className="font-mono text-[12px] text-foreground">{card?.word}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{card?.meaning}</span>
                    </li>
                  )
                })
              )}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader label={`Salah — ${wrong.length}`} />
            <ul className="divide-y divide-rule">
              {wrong.length === 0 ? (
                <li className="px-4 py-3 text-[12px] text-muted-foreground">Tidak ada jawaban salah.</li>
              ) : (
                wrong.map((entry) => {
                  const card = order.find((item) => item.id === entry.questionId)
                  return (
                    <li key={entry.questionId} className="flex items-center gap-2 px-4 py-2.5">
                      <X className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                      <span className="font-mono text-[12px] text-foreground">{card?.word}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{card?.meaning}</span>
                    </li>
                  )
                })
              )}
            </ul>
          </Panel>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {wrong.length > 0 ? (
            <Button
              onClick={() => {
                setOrder(wrong.map((entry) => order.find((item) => item.id === entry.questionId)!).filter(Boolean))
                setCursor(0)
                setAnswers([])
                setChosen(null)
                setFinished(false)
              }}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Ulangi yang salah
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setLevel(null)}>
            Pilih level lain
          </Button>
        </div>
      </div>
    )
  }

  if (!word) return null

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="flex items-center gap-3 border-b border-rule pb-3">
        <MonoLabel className="shrink-0">
          {cursor + 1} / {order.length}
        </MonoLabel>
        <TickRail states={tickStates} className="flex-1 justify-center" />
        <MonoLabel className="shrink-0">{LEVELS.find((entry) => entry.id === level)?.name}</MonoLabel>
      </div>

      <div className="pt-10 text-center">
        <h2 className="text-balance font-heading text-[46px] font-extrabold leading-[1] tracking-[-0.03em] text-foreground sm:text-[58px]">
          {word.word}
        </h2>
        <p className="mt-2 font-mono text-[13px] text-muted-foreground">{word.ipa}</p>
        <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">Apa arti kata ini?</p>
      </div>

      <div className="mt-6 space-y-2">
        {options.map((option, index) => {
          const isChosen = chosen === option
          const isCorrect = option === word.meaning
          const revealed = chosen !== null
          return (
            <button
              key={option}
              type="button"
              onClick={() => answer(option)}
              disabled={revealed}
              className={cn(
                'flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors',
                !revealed && 'border-rule bg-card hover:border-foreground/30 hover:bg-secondary/60',
                revealed && isCorrect && 'border-success/50 bg-success/[0.07]',
                revealed && isChosen && !isCorrect && 'border-destructive/50 bg-destructive/[0.06]',
                revealed && !isCorrect && !isChosen && 'border-rule bg-card opacity-60',
              )}
            >
              <span className="font-mono text-[10px] leading-none text-muted-foreground">{index + 1}</span>
              <span className="flex-1 text-[14px] leading-relaxed text-foreground">{option}</span>
              {revealed && isCorrect ? <Check className="size-4 shrink-0 text-success" aria-hidden="true" /> : null}
              {revealed && isChosen && !isCorrect ? (
                <X className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              ) : null}
            </button>
          )
        })}
      </div>

      {chosen ? (
        <div className="mt-5 border-t border-rule pt-4">
          <div className="flex items-center gap-2">
            {chosen === word.meaning ? (
              <Check className="size-4 text-success" aria-hidden="true" />
            ) : (
              <X className="size-4 text-destructive" aria-hidden="true" />
            )}
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
              {chosen === word.meaning ? 'Benar' : `Salah — jawaban: ${word.meaning}`}
            </p>
          </div>
          {word.tip ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{word.tip}</p>
          ) : null}
          {word.example ? (
            <p className="mt-2 border-l-2 border-l-primary pl-3 text-[13px] italic leading-relaxed text-foreground">
              {word.example}
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="mt-2 text-[12px] text-destructive">
              {saveError}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {saving ? 'Menyimpan progres' : 'Tekan Enter untuk lanjut'}
            </span>
            <Button size="sm" onClick={advance} className="gap-1.5">
              {cursor + 1 >= order.length ? 'Lihat hasil' : 'Lanjut'}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
