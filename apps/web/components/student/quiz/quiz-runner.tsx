'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Flag } from 'lucide-react'
import {
  QUIZ_SECTION_IDS,
  QUIZ_SECTION_LABELS,
  formatQuizClock,
  type QuizAttemptView,
  type QuizSectionId,
} from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import { QuizAudio } from '@/components/student/quiz/quiz-audio'

const LOW_TIME_MS = 5 * 60 * 1_000

export function QuizRunner({
  attempt,
  answers,
  remainingMs,
  onAnswer,
  onSubmit,
  submitting,
  saveState,
  submitError,
}: {
  attempt: QuizAttemptView
  answers: Record<string, number>
  remainingMs: number
  onAnswer: (questionId: string, option: number) => void
  onSubmit: () => void
  submitting: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  submitError: string | null
}) {
  const [cursor, setCursor] = useState(0)
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState(false)

  const questions = attempt.questions
  const current = questions[cursor]
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length
  const unanswered = questions.length - answeredCount
  const flaggedCount = Object.values(flags).filter(Boolean).length
  const lowTime = remainingMs <= LOW_TIME_MS

  const passage = current?.passageId
    ? attempt.passages.find((entry) => entry.id === current.passageId) ?? null
    : null

  const grouped = useMemo(
    () =>
      QUIZ_SECTION_IDS.map((section) => ({
        section,
        items: questions
          .map((question, index) => ({ question, index }))
          .filter((entry) => entry.question.section === section),
      })).filter((group) => group.items.length > 0),
    [questions],
  )

  if (!current) {
    return (
      <p className="border border-rule bg-card px-4 py-8 text-center text-[12px] text-muted-foreground">
        Soal ujian tidak dapat dimuat.
      </p>
    )
  }

  const selected = answers[current.id]
  const flagged = flags[current.id] === true

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 border-b border-rule bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep">
              {QUIZ_SECTION_LABELS[current.section]}
            </span>
            <span className="h-3 w-px bg-rule" aria-hidden="true" />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {cursor + 1}/{questions.length}
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:inline">
              · {answeredCount} terjawab
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              role="timer"
              aria-label={`Sisa waktu ${formatQuizClock(remainingMs)}`}
              className={cn(
                'flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[15px] font-semibold leading-none tabular-nums',
                lowTime ? 'border-destructive/50 bg-destructive/5 text-destructive' : 'border-rule bg-card text-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', lowTime ? 'animate-pulse bg-destructive' : 'bg-primary')}
              />
              {formatQuizClock(remainingMs)}
            </div>
            <Button size="sm" onClick={() => setConfirming(true)} disabled={submitting}>
              Kumpulkan
            </Button>
          </div>
        </div>

        <div className="mt-2.5 h-[3px] w-full overflow-hidden bg-secondary" aria-hidden="true">
          <span
            className="block h-full bg-primary transition-[width] duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {lowTime ? (
        <p role="status" className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11.5px] leading-relaxed text-destructive">
          Sisa waktu kurang dari 5 menit. Jawaban yang sudah tersimpan tetap dinilai saat waktu habis.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] xl:gap-8">
        <div className="min-w-0">
          <div className={cn('grid gap-5', passage && 'lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]')}>
            {passage ? (
              <section aria-label={`Teks: ${passage.title}`} className="min-w-0">
                <div className="border border-rule bg-card">
                  <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
                    <MonoLabel>Reading passage</MonoLabel>
                    <MonoLabel className="tabular-nums">{passage.paragraphs.length} paragraf</MonoLabel>
                  </div>
                  <div className="max-h-[52vh] overflow-y-auto px-4 py-4 lg:max-h-[calc(100vh-260px)]">
                    <h3 className="font-heading text-[15px] font-bold leading-snug text-foreground">{passage.title}</h3>
                    <div className="mt-3 space-y-3">
                      {passage.paragraphs.map((paragraph, index) => (
                        <p key={index} className="text-[13px] leading-[1.75] text-foreground/90">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section aria-label={`Soal ${cursor + 1}`} className="min-w-0">
              <div className="flex items-center justify-between gap-3 border-b border-rule pb-2.5">
                <MonoLabel>
                  Soal {String(cursor + 1).padStart(2, '0')}
                  {current.questionType ? ` · ${current.questionType}` : ''}
                </MonoLabel>
                <button
                  type="button"
                  onClick={() => setFlags((state) => ({ ...state, [current.id]: !flagged }))}
                  aria-pressed={flagged}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                    flagged
                      ? 'border-warning bg-warning/10 text-foreground'
                      : 'border-rule text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  <Flag className="size-3" aria-hidden="true" />
                  {flagged ? 'Ditandai' : 'Tandai'}
                </button>
              </div>

              {current.audioUrl ? (
                <div className="mt-4">
                  <QuizAudio key={current.id} src={current.audioUrl} title={`Rekaman ${cursor + 1}`} />
                </div>
              ) : null}

              <p className="mt-4 text-pretty text-[16px] font-medium leading-[1.6] text-foreground">{current.prompt}</p>

              <div className="mt-4 space-y-2" role="group" aria-label="Pilihan jawaban">
                {current.options.map((option, index) => {
                  const isSelected = selected === index
                  return (
                    <button
                      key={`${current.id}-${index}`}
                      type="button"
                      onClick={() => onAnswer(current.id, index)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-start gap-3 border px-3.5 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/[0.06]'
                          : 'border-rule bg-card hover:border-foreground/30 hover:bg-secondary/50',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[2px] border font-mono text-[10px]',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-rule text-muted-foreground',
                        )}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 text-[13.5px] leading-relaxed text-foreground">{option}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCursor((value) => Math.max(0, value - 1))}
                  disabled={cursor === 0}
                  className="gap-1.5"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Sebelumnya
                </Button>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {saveState === 'saving' ? 'Menyimpan…' : saveState === 'error' ? 'Belum tersimpan' : saveState === 'saved' ? 'Tersimpan' : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCursor((value) => Math.min(questions.length - 1, value + 1))}
                  disabled={cursor + 1 >= questions.length}
                  className="gap-1.5"
                >
                  Berikutnya <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader label="Navigator" right={<MonoLabel>{answeredCount}/{questions.length}</MonoLabel>} />
            <div className="space-y-3 p-3">
              {grouped.map((group) => (
                <div key={group.section}>
                  <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    {QUIZ_SECTION_LABELS[group.section as QuizSectionId]}
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {group.items.map(({ question, index }) => {
                      const answered = answers[question.id] !== undefined
                      const isFlagged = flags[question.id] === true
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => setCursor(index)}
                          aria-label={`Soal ${index + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}${isFlagged ? ', ditandai' : ''}`}
                          aria-current={index === cursor ? 'true' : undefined}
                          className={cn(
                            'relative flex h-8 items-center justify-center font-mono text-[11px] tabular-nums transition-colors',
                            answered ? 'bg-foreground text-background' : 'border border-rule bg-card text-muted-foreground hover:border-foreground/40',
                            isFlagged && 'border-2 border-dashed border-warning',
                            index === cursor && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                          )}
                        >
                          {index + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
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
              {[
                { label: 'Terjawab', value: answeredCount },
                { label: 'Kosong', value: unanswered },
                { label: 'Ditandai', value: flaggedCount },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{row.label}</dt>
                  <dd className="font-mono text-[12px] tabular-nums text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {confirming ? (
            <div role="group" aria-label="Konfirmasi pengumpulan" className="border border-foreground/30 bg-card p-3">
              <p className="text-[12px] leading-relaxed text-foreground">
                {unanswered > 0
                  ? `${unanswered} soal belum dijawab dan akan dihitung salah. Kumpulkan sekarang?`
                  : 'Semua soal sudah dijawab. Kumpulkan sekarang?'}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={onSubmit} disabled={submitting} className="flex-1">
                  {submitting ? 'Menilai…' : 'Kumpulkan'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={() => setConfirming(true)} disabled={submitting}>
              <Check className="size-3.5" aria-hidden="true" /> Kumpulkan jawaban
            </Button>
          )}

          {submitError ? (
            <p role="alert" className="text-[12px] leading-relaxed text-destructive">
              {submitError}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
