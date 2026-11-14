'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Lock, Play, X } from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { useAudioPeaks } from '@/hooks/use-audio-peaks'
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
type Phase = 'levels' | 'briefing' | 'unavailable' | 'listening' | 'deck' | 'result'

const LEVELS: Array<{ id: LevelId; name: string; english: string; topic: string }> = [
  { id: 'beginner', name: 'Mudah', english: 'Beginner', topic: 'Percakapan harian pendek' },
  { id: 'intermediate', name: 'Sedang', english: 'Intermediate', topic: 'Pengumuman dan instruksi' },
  { id: 'advanced', name: 'Sulit', english: 'Advanced', topic: 'Diskusi dan argumen' },
]

type AudioItem = QuestionBankItem & { audioUrl?: string }

export function ListeningTest() {
  const [banks, setBanks] = useState<Record<LevelId, AudioItem[]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId | null>(null)
  const [phase, setPhase] = useState<Phase>('levels')
  const [played, setPlayed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [answers, setAnswers] = useState<Array<number | null>>([])
  const [results, setResults] = useState<Array<boolean | null>>([])
  const [correctOptions, setCorrectOptions] = useState<Array<number | null>>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    Promise.all(
      LEVELS.map((entry) =>
        fetch(`/api/student/question-bank?type=listening&level=${entry.id}&limit=20`, { cache: 'no-store' }).then(
          async (response) => {
            if (!response.ok) throw new Error('LOAD_FAILED')
            return (await response.json()) as { data?: AudioItem[] }
          },
        ),
      ),
    )
      .then((payloads) => {
        const next = {} as Record<LevelId, AudioItem[]>
        LEVELS.forEach((entry, index) => {
          next[entry.id] = payloads[index].data ?? []
        })
        setBanks(next)
      })
      .catch(() => setError('Latihan listening belum dapat dimuat. Coba lagi nanti.'))
  }, [])

  const items = level && banks ? banks[level] : []
  const audioUrl = items[0]?.audioUrl ?? null
  const { peaks } = useAudioPeaks(audioUrl, 64)
  const current = items[cursor] ?? null

  const levelOptions: LevelOption[] = useMemo(
    () =>
      LEVELS.map((entry) => {
        const count = banks?.[entry.id].length ?? 0
        const hasAudio = Boolean(banks?.[entry.id][0]?.audioUrl)
        return {
          id: entry.id,
          name: entry.name,
          english: entry.english,
          count,
          detail: `${entry.topic} · sekali putar · ${count} pertanyaan`,
          disabled: count === 0 || !hasAudio,
          disabledReason:
            count === 0
              ? 'Belum ada pertanyaan listening untuk level ini.'
              : 'Belum ada audio untuk level ini. Suara sintetis browser tidak dipakai sebagai pengganti.',
        }
      }),
    [banks],
  )

  function selectLevel(id: string) {
    const next = id as LevelId
    setLevel(next)
    setPhase('briefing')
    setPlayed(false)
    setProgress(0)
    setCursor(0)
    setAnswers([])
    setResults([])
    setCorrectOptions([])
    setSubmitError(null)
  }

  function startAudio() {
    if (!audioUrl) {
      setPhase('unavailable')
      return
    }
    setPhase('listening')
    setPlayed(true)
    const element = audioRef.current
    if (element) {
      element.currentTime = 0
      void element.play()
    }
  }

  function choose(optionIndex: number) {
    setAnswers((current) => current.map((value, index) => (index === cursor ? optionIndex : value)))
  }

  async function submitDeck() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const nextResults: boolean[] = []
      const nextCorrect: Array<number | null> = []
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
        nextResults.push(payload.data.isCorrect === true)
        nextCorrect.push(payload.data.correctOption ?? null)
      }
      setResults(nextResults)
      setCorrectOptions(nextCorrect)
      setPhase('result')
    } catch {
      setSubmitError('Jawaban belum tersimpan sepenuhnya. Coba kumpulkan lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <EmptyState title="Listening tidak tersedia" description={error} />

  if (!banks) {
    return (
      <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat latihan listening
      </div>
    )
  }

  if (phase === 'levels') {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <MonoLabel>Pilih level</MonoLabel>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Sekali putar
            </span>
          </div>
          <LevelStack options={levelOptions} onSelect={selectLevel} className="mt-4" />
        </div>
        <aside>
          <Panel>
            <PanelHeader label="Aturan sesi" />
            <ul className="divide-y divide-rule">
              {[
                'Audio berdurasi sekitar satu menit.',
                'Audio hanya bisa diputar satu kali. Tidak ada tombol ulang.',
                'Topik diacak dan tidak ditampilkan sebelum audio dimulai.',
                'Pertanyaan muncul satu per satu setelah audio selesai.',
                'Skor akhir dihitung server, bukan di browser.',
              ].map((rule) => (
                <li key={rule} className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
                  {rule}
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    )
  }

  if (phase === 'briefing') {
    const entry = LEVELS.find((item) => item.id === level)
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <Panel>
          <PanelHeader label="Briefing" right={<MonoLabel>{entry?.english}</MonoLabel>} />
          <div className="px-5 py-6">
            <h2 className="font-heading text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
              {entry?.name}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {entry?.topic}. Audio diputar satu kali, lalu {items.length} pertanyaan muncul satu per satu.
            </p>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-rule border-y border-rule">
              <div className="px-3 py-3">
                <MonoLabel>Durasi</MonoLabel>
                <p className="mt-1.5 font-mono text-[13px] text-foreground">~1 menit</p>
              </div>
              <div className="px-3 py-3">
                <MonoLabel>Putar</MonoLabel>
                <p className="mt-1.5 font-mono text-[13px] text-foreground">1×</p>
              </div>
              <div className="px-3 py-3">
                <MonoLabel>Soal</MonoLabel>
                <p className="mt-1.5 font-mono text-[13px] text-foreground">{items.length}</p>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={startAudio} className="gap-1.5">
                <Play className="size-3.5" aria-hidden="true" /> Mulai audio
              </Button>
              <Button variant="ghost" onClick={() => setPhase('levels')}>
                Kembali
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  if (phase === 'unavailable') {
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <Panel tone="sunken">
          <PanelHeader label="Audio tidak tersedia" />
          <div className="px-5 py-6">
            <h2 className="font-heading text-[20px] font-bold tracking-[-0.01em] text-foreground">
              Belum ada audio untuk level ini
            </h2>
            <p className="mt-2 max-w-[52ch] text-pretty text-[13px] leading-relaxed text-muted-foreground">
              Pertanyaan listening sudah tersedia, tetapi berkas audionya belum dipublikasikan. Suara sintetis browser
              tidak dipakai sebagai pengganti karena tidak mewakili pelafalan penutur asli.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPhase('levels')}>
                Pilih level lain
              </Button>
              <Button asChild variant="ghost">
                <Link href="/siswa/pronunciation">Latihan pronunciation</Link>
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  if (phase === 'listening') {
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <Panel>
          <PanelHeader
            label="Audio"
            right={
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {played ? 'Sedang diputar' : 'Siap'}
              </span>
            }
          />
          <div className="px-5 py-6">
            <div className="flex h-20 items-end gap-[2px]" aria-hidden="true">
              {(peaks ?? new Array(64).fill(0)).map((peak, index) => {
                const filled = index / 64 <= progress
                return (
                  <span
                    key={index}
                    className={cn('flex-1 rounded-[1px]', filled ? 'bg-primary' : 'bg-border')}
                    style={{ height: `${Math.max(3, Math.round(peak * 80))}px` }}
                  />
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <MonoLabel>{played ? 'Audio sudah diputar' : 'Belum diputar'}</MonoLabel>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <audio
              ref={audioRef}
              src={audioUrl ?? undefined}
              onTimeUpdate={(event) => {
                const element = event.currentTarget
                if (element.duration > 0) setProgress(element.currentTime / element.duration)
              }}
              onEnded={() => {
                setProgress(1)
                setAnswers(items.map(() => null))
                setResults(items.map(() => null))
                setCorrectOptions(items.map(() => null))
                setPhase('deck')
              }}
              className="hidden"
            />
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
              Audio tidak bisa dijeda atau diulang. Dengarkan sampai selesai; pertanyaan muncul otomatis.
            </p>
          </div>
        </Panel>
      </div>
    )
  }

  if (phase === 'deck' && current) {
    const selected = answers[cursor]
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-3">
          <MonoLabel>
            {cursor + 1} dari {items.length}
          </MonoLabel>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" /> Audio sudah diputar
          </span>
        </div>

        <div className="pt-6">
          <p className="text-pretty text-[17px] font-medium leading-[1.55] text-foreground">{current.prompt}</p>
          <div className="mt-4 space-y-2">
            {current.options.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => choose(index)}
                aria-pressed={selected === index}
                className={cn(
                  'flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors',
                  selected === index
                    ? 'border-primary bg-primary/[0.05]'
                    : 'border-rule bg-card hover:border-foreground/30',
                )}
              >
                <span className="font-mono text-[10px] leading-none text-muted-foreground">{index + 1}</span>
                <span className="flex-1 text-[14px] leading-relaxed text-foreground">{option}</span>
              </button>
            ))}
          </div>
        </div>

        {submitError ? (
          <p role="alert" className="mt-3 text-[12px] text-destructive">
            {submitError}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-rule pt-4">
          <Button variant="ghost" size="sm" onClick={() => setCursor((value) => Math.max(0, value - 1))} disabled={cursor === 0}>
            Sebelumnya
          </Button>
          {cursor + 1 >= items.length ? (
            <Button size="sm" onClick={submitDeck} disabled={answers.some((value) => value === null) || submitting}>
              {submitting ? 'Menyimpan…' : 'Kumpulkan'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setCursor((value) => value + 1)}
              disabled={selected === null}
              className="gap-1.5"
            >
              Berikutnya <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const correct = results.filter(Boolean).length
    const score = items.length === 0 ? 0 : Math.round((correct / items.length) * 100)
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-5">
          <div>
            <MonoLabel>Skor server</MonoLabel>
            <p className="mt-2 font-mono text-[52px] font-semibold leading-none tabular-nums text-foreground">
              {score}
              <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
            </p>
          </div>
          <p className="text-right font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
            {correct} benar
            <br />
            {items.length - correct} salah
          </p>
        </div>

        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {items.map((item, index) => {
            const isCorrect = results[index] === true
            return (
              <li key={item.id} className="px-1 py-3">
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] leading-relaxed text-foreground">{item.prompt}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      Jawabanmu: {answers[index] === null ? '—' : item.options[answers[index] as number]}
                      {correctOptions[index] !== null ? ` · Benar: ${item.options[correctOptions[index] as number]}` : ''}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={() => setPhase('levels')}>
            Pilih level lain
          </Button>
        </div>
      </div>
    )
  }

  return null
}
