'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Flag, X } from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState, MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'

type Result = { isCorrect: boolean; correctOption: number | null }

const EXAM_SIZE = 10

function interleave(groups: QuestionBankItem[][]) {
  const output: QuestionBankItem[] = []
  const longest = Math.max(...groups.map((group) => group.length), 0)
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const item = group[index]
      if (item) output.push(item)
    }
  }
  return output
}

export function ExamSheet() {
  const [items, setItems] = useState<QuestionBankItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Array<number | null>>([])
  const [flags, setFlags] = useState<boolean[]>([])
  const [cursor, setCursor] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[] | null>(null)

  useEffect(() => {
    Promise.all(
      ['grammar', 'reading'].map((skill) =>
        fetch(`/api/student/question-bank?skill=${skill}&limit=20`, { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) throw new Error('LOAD_FAILED')
          return (await response.json()) as { data?: QuestionBankItem[] }
        }),
      ),
    )
      .then((payloads) => {
        const merged = interleave(payloads.map((payload) => payload.data ?? []))
          .filter((item) => item.options.length >= 2)
          .slice(0, EXAM_SIZE)
        setItems(merged)
        setAnswers(merged.map(() => null))
        setFlags(merged.map(() => false))
      })
      .catch(() => setError('Bank soal belum dapat dimuat. Coba lagi beberapa saat lagi.'))
  }, [])

  const answeredCount = answers.filter((value) => value !== null).length
  const flaggedCount = flags.filter(Boolean).length
  const unanswered = answers.length - answeredCount
  const current = items?.[cursor] ?? null

  const score = useMemo(() => {
    if (!results) return 0
    const correct = results.filter((entry) => entry.isCorrect).length
    return results.length === 0 ? 0 : Math.round((correct / results.length) * 100)
  }, [results])

  async function submit() {
    if (!items) return
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
      setConfirming(false)
    } catch {
      setSubmitError('Jawaban belum tersimpan sepenuhnya. Periksa koneksi lalu kumpulkan lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <EmptyState title="Bank soal tidak tersedia" description={error} />

  if (!items) {
    return (
      <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat lembar ujian
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Belum ada soal"
        description="Guru belum mempublikasikan soal grammar atau reading untuk kuis besar."
      />
    )
  }

  if (results) {
    const correct = results.filter((entry) => entry.isCorrect).length
    return (
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-5">
          <div>
            <MonoLabel>Hasil ujian</MonoLabel>
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

        <ol className="mt-4 divide-y divide-rule border-y border-rule">
          {items.map((item, index) => {
            const entry = results[index]
            const chosen = answers[index]
            return (
              <li key={item.id} className="py-4">
                <div className="flex items-start gap-2">
                  {entry.isCorrect ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-relaxed text-foreground">
                      <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {item.prompt}
                    </p>
                    <dl className="mt-2 grid gap-1 font-mono text-[11px] leading-relaxed">
                      <div className="flex gap-2">
                        <dt className="w-[86px] shrink-0 uppercase tracking-[0.1em] text-muted-foreground">Jawabanmu</dt>
                        <dd className={entry.isCorrect ? 'text-foreground' : 'text-destructive'}>
                          {chosen === null ? '—' : item.options[chosen]}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-[86px] shrink-0 uppercase tracking-[0.1em] text-muted-foreground">Kunci</dt>
                        <dd className="text-foreground">
                          {entry.correctOption === null ? '—' : item.options[entry.correctOption]}
                        </dd>
                      </div>
                    </dl>
                    {item.explanation ? (
                      <p className="mt-2 border-l-2 border-l-primary pl-3 text-[12px] leading-relaxed text-muted-foreground">
                        {item.explanation}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_248px] lg:gap-8">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-3">
          <MonoLabel>
            Soal {cursor + 1} / {items.length}
          </MonoLabel>
          <button
            type="button"
            onClick={() => setFlags((current) => current.map((value, index) => (index === cursor ? !value : value)))}
            aria-pressed={flags[cursor]}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
              flags[cursor]
                ? 'border-warning bg-warning/10 text-foreground'
                : 'border-rule text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            <Flag className="size-3" aria-hidden="true" />
            {flags[cursor] ? 'Ditandai' : 'Tandai'}
          </button>
        </div>

        {current ? (
          <div className="pt-6">
            <p className="text-pretty text-[17px] font-medium leading-[1.6] text-foreground">{current.prompt}</p>
            <div className="mt-5 space-y-2">
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
                      'flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/[0.05]'
                        : 'border-rule bg-card hover:border-foreground/30 hover:bg-secondary/50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-[2px] border font-mono text-[10px]',
                        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-rule text-muted-foreground',
                      )}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1 text-[14px] leading-relaxed text-foreground">{option}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between border-t border-rule pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((value) => Math.max(0, value - 1))}
            disabled={cursor === 0}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor((value) => Math.min(items.length - 1, value + 1))}
            disabled={cursor + 1 >= items.length}
            className="gap-1.5"
          >
            Berikutnya <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <aside className="space-y-4">
        <Panel>
          <PanelHeader label="Navigator" right={<MonoLabel>{answeredCount}/{items.length}</MonoLabel>} />
          <div className="grid grid-cols-5 gap-1.5 p-3">
            {items.map((item, index) => {
              const answered = answers[index] !== null
              const flagged = flags[index]
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCursor(index)}
                  aria-label={`Soal ${index + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}${flagged ? ', ditandai' : ''}`}
                  aria-current={index === cursor ? 'true' : undefined}
                  className={cn(
                    'relative flex h-9 items-center justify-center font-mono text-[11px] tabular-nums transition-colors',
                    answered
                      ? 'bg-foreground text-background'
                      : 'border border-rule bg-card text-muted-foreground hover:border-foreground/40',
                    flagged && 'border-2 border-dashed border-warning',
                    index === cursor && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                  )}
                >
                  {index + 1}
                  {flagged ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-warning font-mono text-[7px] font-bold leading-none text-warning-foreground"
                    >
                      !
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <ul className="space-y-1.5 border-t border-rule px-3 py-3">
            <li className="flex items-center gap-2">
              <span className="size-3 border border-rule bg-card" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Belum dijawab</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 bg-foreground" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Sudah dijawab</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 border-2 border-dashed border-warning" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Ditandai</span>
            </li>
          </ul>
        </Panel>

        <Panel>
          <PanelHeader label="Ringkasan" />
          <dl className="divide-y divide-rule">
            <div className="flex items-center justify-between px-3 py-2.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Terjawab</dt>
              <dd className="font-mono text-[12px] tabular-nums text-foreground">{answeredCount}</dd>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Kosong</dt>
              <dd className="font-mono text-[12px] tabular-nums text-foreground">{unanswered}</dd>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Ditandai</dt>
              <dd className="font-mono text-[12px] tabular-nums text-foreground">{flaggedCount}</dd>
            </div>
          </dl>
        </Panel>

        {confirming ? (
          <div role="group" aria-label="Konfirmasi pengumpulan" className="border border-foreground/30 bg-card p-3">
            <p className="text-[12px] leading-relaxed text-foreground">
              {unanswered > 0
                ? `${unanswered} soal belum dijawab. Soal kosong dihitung salah.`
                : 'Semua soal sudah dijawab. Kumpulkan sekarang?'}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={submit} disabled={submitting} className="flex-1">
                {submitting ? 'Menyimpan…' : 'Kumpulkan'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setConfirming(true)}>
            Kumpulkan jawaban
          </Button>
        )}

        {submitError ? (
          <p role="alert" className="text-[12px] leading-relaxed text-destructive">
            {submitError}
          </p>
        ) : null}
      </aside>
    </div>
  )
}
