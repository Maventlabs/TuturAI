'use client'

import { useState } from 'react'
import { PracticeHeader } from '@/components/student/practice/practice-ui'
import { ExamSheet } from '@/components/student/exam-sheet'
import { ReadingAnalysis } from '@/components/student/reading-analysis'
import { cn } from '@/lib/utils'

const MODES = [
  {
    id: 'exam',
    label: 'Kuis Besar',
    detail: 'Lembar ujian campuran dengan navigator soal dan penandaan.',
  },
  {
    id: 'reading',
    label: 'Analisis Teks',
    detail: 'Baca teks pendek, tandai kalimat bukti, lalu jawab pertanyaan.',
  },
] as const

type ModeId = (typeof MODES)[number]['id']

export default function QuizPage() {
  const [mode, setMode] = useState<ModeId>('exam')
  const active = MODES.find((entry) => entry.id === mode) ?? MODES[0]

  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Quiz"
        title="Kuis Harian"
        description="Dua mode dalam satu pintu: lembar ujian campuran, atau analisis teks pendek dengan penandaan bukti."
        meta={[
          { label: 'Mode', value: 2 },
          { label: 'Soal / sesi', value: 10 },
          { label: 'Skor', value: 'Server' },
        ]}
      />

      <div className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Mode kuis" className="flex overflow-x-auto rounded-sm border border-rule">
          {MODES.map((entry) => {
            const selected = entry.id === mode
            return (
              <button
                key={entry.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setMode(entry.id)}
                className={cn(
                  'shrink-0 border-r border-rule px-4 py-2.5 font-mono text-[10px] uppercase leading-none tracking-[0.14em] transition-colors last:border-r-0',
                  selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {entry.label}
              </button>
            )
          })}
        </div>
        <p className="max-w-[52ch] text-pretty text-[12px] leading-relaxed text-muted-foreground">{active.detail}</p>
      </div>

      {mode === 'exam' ? <ExamSheet /> : <ReadingAnalysis />}
    </div>
  )
}
