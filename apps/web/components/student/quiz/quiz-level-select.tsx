'use client'

import { ArrowUpRight } from 'lucide-react'
import type { QuestionLevel, QuizAttemptSummary } from '@tuturai/domain'
import { LevelCardGrid } from '@/components/student/practice/level-cards'
import { MonoLabel, Panel, PanelHeader, type LevelOption } from '@/components/student/practice/practice-ui'

const LEVELS: LevelOption[] = [
  {
    id: 'beginner',
    name: 'Pemula',
    english: 'Beginner',
    count: 30,
    detail: 'Teks dan rekaman pendek dengan informasi yang jelas. Distraktor tetap masuk akal, jadi membaca sampai selesai tetap wajib.',
    action: 'Pilih level',
  },
  {
    id: 'intermediate',
    name: 'Menengah',
    english: 'Intermediate',
    count: 30,
    detail: 'Parafrase dan sinonim mendominasi. Jawaban jarang memakai kata yang sama dengan sumber, dan hubungan antaride ikut diuji.',
    action: 'Pilih level',
  },
  {
    id: 'advanced',
    name: 'Mahir',
    english: 'Advanced',
    count: 30,
    detail: 'Inferensi, sikap pembicara, dan kosakata akademik. Distraktor cukup kuat sehingga hanya pemahaman penuh yang lolos.',
    action: 'Pilih level',
  },
]

const COMPOSITION = [
  { section: 'Reading Comprehension', detail: '2 teks · 3–4 paragraf per teks', count: 10 },
  { section: 'Listening Comprehension', detail: '10 rekaman dari bank audio', count: 10 },
  { section: 'General Questions', detail: 'Grammar, vocabulary, ungkapan', count: 10 },
]

const LEVEL_LABEL: Record<QuestionLevel, string> = {
  beginner: 'Pemula',
  intermediate: 'Menengah',
  advanced: 'Mahir',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function QuizLevelSelect({
  onSelect,
  history,
  onOpenAttempt,
  busy,
}: {
  onSelect: (level: QuestionLevel) => void
  history: QuizAttemptSummary[]
  onOpenAttempt: (attemptId: string) => void
  busy: boolean
}) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="quiz-level-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-3">
          <div>
            <MonoLabel className="text-primary-deep">Langkah 01</MonoLabel>
            <h2 id="quiz-level-heading" className="mt-2 font-heading text-[18px] font-bold tracking-[-0.01em] text-foreground">
              Pilih level ujian
            </h2>
          </div>
          <p className="max-w-[38ch] text-right text-[11.5px] leading-relaxed text-muted-foreground">
            Soal diambil hanya dari bank level yang kamu pilih. Level tidak bisa ditukar di tengah ujian.
          </p>
        </div>

        <LevelCardGrid
          options={LEVELS.map((level) => ({ ...level, disabled: busy }))}
          onSelect={(id) => onSelect(id as QuestionLevel)}
          activeId={null}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Panel>
          <PanelHeader label="Komposisi ujian" right={<MonoLabel>30 menit</MonoLabel>} />
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Komposisi 30 soal ujian terintegrasi</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="px-4 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Section
                </th>
                <th scope="col" className="px-4 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Isi
                </th>
                <th scope="col" className="px-4 py-2 text-right font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Soal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {COMPOSITION.map((row) => (
                <tr key={row.section}>
                  <th scope="row" className="px-4 py-3 text-[12.5px] font-semibold text-foreground">
                    {row.section}
                  </th>
                  <td className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">{row.detail}</td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-foreground">{row.count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule">
                <th scope="row" className="px-4 py-3 text-[12px] font-semibold text-foreground">
                  Total
                </th>
                <td className="px-4 py-3 text-[12px] text-muted-foreground">Bobot seimbang 1/3 per section</td>
                <td className="px-4 py-3 text-right font-mono text-[12px] font-semibold tabular-nums text-foreground">30</td>
              </tr>
            </tfoot>
          </table>
        </Panel>

        <Panel>
          <PanelHeader label="Riwayat ujian" right={<MonoLabel>{history.length}</MonoLabel>} />
          {history.length === 0 ? (
            <p className="px-4 py-6 text-[12px] leading-relaxed text-muted-foreground">
              Belum ada ujian yang dikerjakan. Hasil setiap ujian akan tersimpan di sini.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onOpenAttempt(entry.id)}
                    className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {LEVEL_LABEL[entry.level]} · {formatDate(entry.startedAt)}
                      </span>
                      <span className="mt-1 block text-[12px] text-foreground">
                        {entry.status === 'in_progress'
                          ? 'Sedang berjalan'
                          : `${entry.correct ?? 0}/${entry.total} benar`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
                        {entry.finalScore ?? '—'}
                      </span>
                      <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
