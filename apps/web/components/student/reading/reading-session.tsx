'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react'
import type { ReadingSessionView } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * One practice session: two passages, five questions each.
 *
 * The second passage stays locked until all five questions of the first are
 * answered, which is the session rule the student is told before starting. The
 * passage text stays on screen beside the question so an answer can always be
 * traced back to the sentence that supports it.
 */
export function ReadingSession({
  session,
  answers,
  onAnswer,
  onSubmit,
  submitting,
  saveState,
  submitError,
}: {
  session: ReadingSessionView
  answers: Record<string, number>
  onAnswer: (questionId: string, option: number) => void
  onSubmit: () => void
  submitting: boolean
  saveState: SaveState
  submitError: string | null
}) {
  const [passageIndex, setPassageIndex] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const passages = session.passages
  const passage = passages[passageIndex] ?? null

  const questionsByPassage = useMemo(
    () =>
      passages.map((entry) => session.questions.filter((question) => question.passageId === entry.id)),
    [passages, session.questions],
  )

  const answeredIn = (index: number) =>
    (questionsByPassage[index] ?? []).filter((question) => answers[question.id] !== undefined).length

  const firstPassageComplete =
    (questionsByPassage[0]?.length ?? 0) > 0 && answeredIn(0) === questionsByPassage[0].length

  const answeredCount = session.questions.filter((question) => answers[question.id] !== undefined).length
  const total = session.questions.length
  const unanswered = total - answeredCount

  const passageQuestions = questionsByPassage[passageIndex] ?? []
  const current = passageQuestions[cursor] ?? null
  const selected = current ? answers[current.id] : undefined
  const isLastInPassage = cursor + 1 >= passageQuestions.length
  const isLastPassage = passageIndex + 1 >= passages.length

  if (!passage || !current) {
    return (
      <p className="border border-rule bg-card px-4 py-8 text-center text-[12px] text-muted-foreground">
        Passage sesi ini tidak dapat dimuat.
      </p>
    )
  }

  function openPassage(index: number) {
    if (index > 0 && !firstPassageComplete) return
    setPassageIndex(index)
    setCursor(0)
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 border-b border-rule bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep">
              Reading · {session.level}
            </span>
            <span className="h-3 w-px bg-rule" aria-hidden="true" />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {answeredCount}/{total} terjawab
            </span>
          </div>
          <Button size="sm" onClick={() => setConfirming(true)} disabled={submitting}>
            Kumpulkan
          </Button>
        </div>
        <div className="mt-2.5 h-[3px] w-full overflow-hidden bg-secondary" aria-hidden="true">
          <span
            className="block h-full bg-primary transition-[width] duration-300"
            style={{ width: `${total === 0 ? 0 : (answeredCount / total) * 100}%` }}
          />
        </div>
      </div>

      <div role="tablist" aria-label="Passage" className="grid gap-2 sm:grid-cols-2">
        {passages.map((entry, index) => {
          const locked = index > 0 && !firstPassageComplete
          const active = index === passageIndex
          const done = answeredIn(index)
          const count = questionsByPassage[index]?.length ?? 0
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={locked}
              onClick={() => openPassage(index)}
              className={cn(
                'flex items-center justify-between gap-3 border px-3.5 py-2.5 text-left transition-colors',
                active ? 'border-primary bg-primary/[0.05]' : 'border-rule bg-card hover:border-foreground/30',
                locked && 'cursor-not-allowed opacity-60 hover:border-rule',
              )}
            >
              <span className="min-w-0">
                <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Passage {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-1 block truncate text-[12.5px] font-medium text-foreground">{entry.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {locked ? <Lock className="size-3" aria-hidden="true" /> : null}
                {done}/{count}
              </span>
            </button>
          )
        })}
      </div>

      {passageIndex === 0 && !firstPassageComplete ? (
        <p className="border border-rule bg-secondary/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Passage 02 terbuka setelah kelima pertanyaan passage ini terjawab.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] xl:gap-8">
        <div className="min-w-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
            <section aria-label={`Teks: ${passage.title}`} className="min-w-0">
              <div className="border border-rule bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
                  <MonoLabel>Reading passage {String(passageIndex + 1).padStart(2, '0')}</MonoLabel>
                  <MonoLabel className="tabular-nums">{passage.paragraphs.length} paragraf</MonoLabel>
                </div>
                <div className="max-h-[42vh] overflow-y-auto px-4 py-4 lg:max-h-[calc(100vh-300px)]">
                  <h3 className="font-heading text-[15px] font-bold leading-snug text-foreground">{passage.title}</h3>
                  {passage.topic ? (
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      {passage.topic}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-3">
                    {passage.paragraphs.map((paragraph, index) => (
                      <div key={index} className="flex gap-2.5">
                        <span
                          className="mt-1 shrink-0 font-mono text-[9px] leading-none text-muted-foreground/70"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <p className="text-[13px] leading-[1.75] text-foreground/90">{paragraph}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section aria-label={`Soal ${cursor + 1}`} className="min-w-0">
              <div className="flex items-center justify-between gap-3 border-b border-rule pb-2.5">
                <MonoLabel>
                  Soal {String(cursor + 1).padStart(2, '0')} dari {passageQuestions.length}
                  {current.questionType ? ` · ${current.questionType}` : ''}
                </MonoLabel>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  {saveState === 'saving'
                    ? 'Menyimpan…'
                    : saveState === 'error'
                      ? 'Belum tersimpan'
                      : saveState === 'saved'
                        ? 'Tersimpan'
                        : ''}
                </span>
              </div>

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

                {isLastInPassage ? (
                  isLastPassage ? (
                    <Button size="sm" onClick={() => setConfirming(true)} disabled={submitting} className="gap-1.5">
                      <Check className="size-3.5" aria-hidden="true" /> Kumpulkan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => openPassage(passageIndex + 1)}
                      disabled={!firstPassageComplete}
                      className="gap-1.5"
                    >
                      Passage berikutnya <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  )
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCursor((value) => Math.min(passageQuestions.length - 1, value + 1))}
                    className="gap-1.5"
                  >
                    Berikutnya <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader
              label={`Passage ${String(passageIndex + 1).padStart(2, '0')}`}
              right={<MonoLabel>{answeredIn(passageIndex)}/{passageQuestions.length}</MonoLabel>}
            />
            <div className="grid grid-cols-5 gap-1.5 p-3">
              {passageQuestions.map((question, index) => {
                const answered = answers[question.id] !== undefined
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setCursor(index)}
                    aria-label={`Soal ${index + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}`}
                    aria-current={index === cursor ? 'true' : undefined}
                    className={cn(
                      'flex h-8 items-center justify-center font-mono text-[11px] tabular-nums transition-colors',
                      answered ? 'bg-foreground text-background' : 'border border-rule bg-card text-muted-foreground hover:border-foreground/40',
                      index === cursor && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                    )}
                  >
                    {index + 1}
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
            </ul>
          </Panel>

          <Panel>
            <PanelHeader label="Sesi" />
            <dl className="divide-y divide-rule">
              {[
                { label: 'Terjawab', value: `${answeredCount}/${total}` },
                { label: 'Kosong', value: unanswered },
                { label: 'Passage', value: `${passageIndex + 1}/${passages.length}` },
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
