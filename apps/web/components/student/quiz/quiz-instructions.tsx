'use client'

import { ArrowLeft, Clock, Headphones, ListChecks, Timer } from 'lucide-react'
import type { QuestionLevel } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'

const LEVEL_LABEL: Record<QuestionLevel, string> = {
  beginner: 'Pemula · Beginner',
  intermediate: 'Menengah · Intermediate',
  advanced: 'Mahir · Advanced',
}

const SECTIONS = [
  { label: 'Reading Comprehension', count: 10, note: '2 teks, 5 soal per teks' },
  { label: 'Listening Comprehension', count: 10, note: '10 rekaman audio' },
  { label: 'General Questions', count: 10, note: 'Grammar, vocabulary, ungkapan' },
]

const RULES = [
  'Timer 30 menit baru berjalan setelah kamu menekan tombol mulai.',
  'Waktu tidak dapat dijeda atau diulang. Menutup halaman tidak menghentikan timer.',
  'Jawaban tersimpan otomatis setiap kali kamu memilih opsi.',
  'Soal yang dibiarkan kosong dihitung salah.',
  'Saat waktu habis, ujian ditutup otomatis dan jawaban yang sudah tersimpan dinilai.',
]

export function QuizInstructions({
  level,
  onStart,
  onBack,
  starting,
  error,
}: {
  level: QuestionLevel
  onStart: () => void
  onBack: () => void
  starting: boolean
  error: string | null
}) {
  return (
    <div className="mx-auto w-full max-w-[880px] space-y-5">
      <div className="flex items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <MonoLabel className="text-primary-deep">Langkah 02</MonoLabel>
          <h2 className="mt-2 font-heading text-[22px] font-bold tracking-[-0.02em] text-foreground">
            Instruksi ujian
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={starting}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Ganti level
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: ListChecks, label: 'Total soal', value: '30', unit: 'soal' },
          { icon: Timer, label: 'Batas waktu', value: '30', unit: 'menit' },
          { icon: Clock, label: 'Level', value: LEVEL_LABEL[level].split(' · ')[0], unit: '' },
        ].map((item) => (
          <div key={item.label} className="border border-rule bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <item.icon className="size-3.5 text-primary-deep" aria-hidden="true" />
              <MonoLabel>{item.label}</MonoLabel>
            </div>
            <p className="mt-2 font-mono text-[22px] font-semibold leading-none tabular-nums text-foreground">
              {item.value}
              {item.unit ? (
                <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.unit}</span>
              ) : null}
            </p>
          </div>
        ))}
      </div>

      <Panel>
        <PanelHeader label="Pembagian section" right={<MonoLabel>Bobot 1/3 tiap section</MonoLabel>} />
        <ul className="divide-y divide-rule">
          {SECTIONS.map((section) => (
            <li key={section.label} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{section.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{section.note}</p>
              </div>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-foreground">{section.count} soal</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel tone="sunken">
        <PanelHeader label="Aturan pengerjaan" />
        <ol className="space-y-2.5 px-4 py-4">
          {RULES.map((rule, index) => (
            <li key={rule} className="flex gap-3">
              <span className="mt-0.5 font-mono text-[10px] tabular-nums leading-[1.6] text-primary-deep">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[12.5px] leading-relaxed text-foreground">{rule}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <Headphones className="size-3.5 shrink-0" aria-hidden="true" />
          Siapkan headphone sebelum memulai bagian Listening.
        </p>
        <Button size="lg" onClick={onStart} disabled={starting} className="w-full sm:w-auto">
          {starting ? 'Menyiapkan soal…' : 'Siap, Mulai Quiz'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[12px] leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
