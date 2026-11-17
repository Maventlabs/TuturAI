'use client'

import { useMemo, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import type { ReadingReviewItem, ReadingSessionView } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import { ScoreDialog } from '@/components/student/score-dialog'

type Filter = 'wrong' | 'blank' | 'all'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'wrong', label: 'Salah' },
  { id: 'blank', label: 'Kosong' },
  { id: 'all', label: 'Semua' },
]

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes} menit ${String(rest).padStart(2, '0')} detik`
}

function band(score: number) {
  if (score >= 85) return { label: 'Kuat', note: 'Pemahaman konsisten di passage ini.' }
  if (score >= 70) return { label: 'Cukup', note: 'Dasar sudah terbentuk, detail masih bisa dipertajam.' }
  if (score >= 50) return { label: 'Berkembang', note: 'Perlu latihan terarah pada tipe soal yang salah.' }
  return { label: 'Perlu latihan', note: 'Baca ulang passage ini dengan tempo lebih lambat.' }
}

function ReviewRow({ item }: { item: ReadingReviewItem }) {
  return (
    <li className="py-4">
      <div className="flex items-start gap-2.5">
        {item.isCorrect ? (
          <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          {item.questionType ? (
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{item.questionType}</p>
          ) : null}
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{item.prompt}</p>

          <ul className="mt-2.5 space-y-1">
            {item.options.map((option, index) => {
              const isKey = index === item.correctOption
              const isChosen = index === item.selectedOption
              return (
                <li
                  key={`${item.questionId}-${index}`}
                  className={cn(
                    'flex items-start gap-2 border px-2.5 py-1.5 text-[12px] leading-relaxed',
                    isKey && 'border-success/50 bg-success/5 text-foreground',
                    !isKey && isChosen && 'border-destructive/50 bg-destructive/5 text-foreground',
                    !isKey && !isChosen && 'border-transparent text-muted-foreground',
                  )}
                >
                  <span className="mt-px font-mono text-[10px] text-muted-foreground">{String.fromCharCode(65 + index)}</span>
                  <span className="flex-1">{option}</span>
                  {isKey ? (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-success">kunci</span>
                  ) : isChosen ? (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-destructive">jawabanmu</span>
                  ) : null}
                </li>
              )
            })}
          </ul>

          {item.selectedOption === null ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Tidak dijawab</p>
          ) : null}

          {item.explanation ? (
            <p className="mt-2.5 border-l-2 border-l-primary pl-3 text-[12px] leading-relaxed text-muted-foreground">
              {item.explanation}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function ReadingResult({
  session,
  onRestart,
  onRepeat,
}: {
  session: ReadingSessionView
  onRestart: () => void
  onRepeat: () => void
}) {
  const [filter, setFilter] = useState<Filter>('wrong')
  const [scoreOpen, setScoreOpen] = useState(true)
  const result = session.result

  const passageTallies = useMemo(() => {
    if (!result) return []
    return session.passages.map((passage) => {
      const items = result.review.filter((item) => item.passageId === passage.id)
      const correct = items.filter((item) => item.isCorrect).length
      return {
        id: passage.id,
        title: passage.title,
        correct,
        total: items.length,
        score: items.length === 0 ? 0 : Math.round((correct / items.length) * 100),
      }
    })
  }, [result, session.passages])

  if (!result) {
    return (
      <p className="border border-rule bg-card px-4 py-8 text-center text-[12px] text-muted-foreground">
        Hasil sesi reading belum tersedia.
      </p>
    )
  }

  const review = result.review.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'blank') return item.selectedOption === null
    return item.selectedOption !== null && !item.isCorrect
  })

  const weakest = [...passageTallies].sort((left, right) => left.score - right.score)[0]
  const strongest = [...passageTallies].sort((left, right) => right.score - left.score)[0]

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6">
      <header className="border-b border-rule pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <MonoLabel className="text-primary-deep">Sesi reading dikumpulkan</MonoLabel>
            <p className="mt-2 font-mono text-[56px] font-semibold leading-none tabular-nums text-foreground">
              {result.score}
              <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {result.correct} benar · {result.incorrect} salah · {result.unanswered} kosong dari {result.total} soal
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Waktu pengerjaan</dt>
              <dd className="mt-1 font-mono text-[12px] tabular-nums text-foreground">{formatDuration(result.durationSeconds)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Level</dt>
              <dd className="mt-1 font-mono text-[12px] uppercase tracking-[0.08em] text-foreground">{session.level}</dd>
            </div>
          </dl>
        </div>
      </header>

      <Panel>
        <PanelHeader label="Performa per passage" right={<MonoLabel>5 soal per passage</MonoLabel>} />
        <div className="space-y-4 px-4 py-4">
          {passageTallies.map((entry, index) => {
            const info = band(entry.score)
            return (
              <div key={entry.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">
                    <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {entry.title}
                  </p>
                  <p className="shrink-0 font-mono text-[12px] tabular-nums text-foreground">
                    {entry.score}
                    <span className="ml-1 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      · {entry.correct}/{entry.total}
                    </span>
                  </p>
                </div>
                <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-[1px] bg-secondary">
                  <span
                    className={cn(
                      'block h-full',
                      entry.score >= 70 ? 'bg-primary' : entry.score >= 50 ? 'bg-warning' : 'bg-destructive',
                    )}
                    style={{ width: `${Math.max(2, entry.score)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-mono uppercase tracking-[0.1em] text-foreground/70">{info.label}</span> · {info.note}
                </p>
              </div>
            )
          })}
        </div>
      </Panel>

      {strongest && weakest ? (
        <Panel tone="sunken">
          <PanelHeader label="Ringkasan" />
          <div className="space-y-2 px-4 py-4 text-[12.5px] leading-relaxed text-foreground">
            {strongest.id === weakest.id ? (
              <p>
                Kedua passage berada di skor yang sama, {strongest.score}. Belum ada passage yang menonjol; ulangi
                level ini untuk melihat apakah hasilnya bertahan.
              </p>
            ) : (
              <p>
                Passage terkuatmu adalah <strong className="font-semibold">{strongest.title}</strong> dengan skor{' '}
                {strongest.score}. Passage yang paling perlu perhatian adalah{' '}
                <strong className="font-semibold">{weakest.title}</strong> dengan skor {weakest.score}.
              </p>
            )}
            <p className="text-muted-foreground">
              {result.unanswered > 0
                ? `${result.unanswered} soal dibiarkan kosong. Pada sesi berikutnya, jawab semua soal — jawaban kosong selalu dihitung salah.`
                : 'Semua soal terjawab. Baca pembahasan di bawah untuk melihat kalimat yang mendukung setiap kunci.'}
            </p>
          </div>
        </Panel>
      ) : null}

      <section aria-labelledby="reading-review-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
          <div>
            <MonoLabel className="text-primary-deep">Review</MonoLabel>
            <h2 id="reading-review-heading" className="mt-1.5 font-heading text-[17px] font-bold text-foreground">
              Pembahasan jawaban
            </h2>
          </div>
          <div role="tablist" aria-label="Filter review" className="flex overflow-hidden rounded-sm border border-rule">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                aria-selected={filter === entry.id}
                onClick={() => setFilter(entry.id)}
                className={cn(
                  'border-r border-rule px-3 py-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.12em] transition-colors last:border-r-0',
                  filter === entry.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {review.length === 0 ? (
          <p className="border border-rule bg-card px-4 py-6 text-center text-[12px] text-muted-foreground">
            {filter === 'wrong'
              ? 'Tidak ada jawaban salah. Kerja bagus.'
              : filter === 'blank'
                ? 'Tidak ada soal kosong.'
                : 'Tidak ada soal untuk ditampilkan.'}
          </p>
        ) : (
          <div className="space-y-5">
            {session.passages.map((passage, index) => {
              const items = review.filter((item) => item.passageId === passage.id)
              if (items.length === 0) return null
              return (
                <div key={passage.id}>
                  <p className="border-b border-rule pb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    Passage {String(index + 1).padStart(2, '0')} · {passage.title}
                  </p>
                  <ol className="divide-y divide-rule border-b border-rule">
                    {items.map((item) => (
                      <ReviewRow key={item.questionId} item={item} />
                    ))}
                  </ol>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onRestart}>
          Pilih level lain
        </Button>
        <Button variant="outline" onClick={onRepeat} className="gap-1.5">
          <RotateCcw className="size-3.5" aria-hidden="true" /> Sesi baru level ini
        </Button>
      </div>

      <ScoreDialog
        open={scoreOpen}
        eyebrow="Latihan reading selesai"
        score={result.score}
        detail={`${result.correct} benar · ${result.incorrect} salah · ${result.unanswered} kosong`}
        onClose={() => setScoreOpen(false)}
      />
    </div>
  )
}
