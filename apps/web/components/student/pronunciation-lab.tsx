'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Minus,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { useMicrophone } from '@/hooks/use-microphone'
import { useAudioPeaks } from '@/hooks/use-audio-peaks'
import { cn } from '@/lib/utils'
import { MonoLabel, Panel, PanelHeader, Readout } from '@/components/student/practice/practice-ui'
import { ScoreDialog } from '@/components/student/score-dialog'

type PronunciationResult = {
  id: string
  questionId: string
  targetText: string
  transcript: string
  heardWord: string
  score: number
  confidence: number | null
  verdict: 'correct' | 'close' | 'incorrect'
  feedback: string
  segments: Array<{ target: string; heard: string | null; match: boolean }>
}

const VERDICT = {
  correct: { label: 'Tepat', Icon: Check, tone: 'text-success' },
  close: { label: 'Hampir', Icon: Minus, tone: 'text-warning' },
  incorrect: { label: 'Kurang tepat', Icon: AlertTriangle, tone: 'text-destructive' },
} as const

function levelLabel(level: QuestionBankItem['level']) {
  return level === 'beginner' ? 'Pemula' : level === 'intermediate' ? 'Menengah' : 'Lanjutan'
}

export function PronunciationLab({
  words,
  levelName,
  onExit,
}: {
  words: QuestionBankItem[]
  levelName: string
  onExit: () => void
}) {
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<PronunciationResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const submittedAudio = useRef<Blob | null>(null)
  const scoresRef = useRef<Record<string, number>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mic = useMicrophone()
  const { peaks, duration } = useAudioPeaks(mic.audioUrl)
  const word = words[index]
  const recording = mic.status === 'recording'
  const micBlocked = mic.status === 'denied' || mic.status === 'error' || mic.status === 'unsupported'
  const scoredCount = Object.keys(scores).length
  const average = scoredCount > 0
    ? Math.round(Object.values(scores).reduce((total, value) => total + value, 0) / scoredCount)
    : 0
  const complete = words.length > 0 && scoredCount === words.length

  useEffect(() => {
    if (!words.length) return
    const attemptId = new URLSearchParams(window.location.search).get('attemptId')
    if (!attemptId) return
    const controller = new AbortController()
    fetch(`/api/student/pronunciation?attemptId=${encodeURIComponent(attemptId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: PronunciationResult; error?: { message?: string } }
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? 'Hasil pronunciation tidak tersedia untuk latihan ini.')
        }
        const attempt = payload.data
        const targetIndex = words.findIndex((item) => item.id === attempt.questionId)
        if (targetIndex < 0) throw new Error('Hasil pronunciation tidak tersedia untuk latihan ini.')
        setIndex(targetIndex)
        setResult(attempt)
        setMessage(attempt.feedback)
        const nextScores = { ...scoresRef.current, [attempt.questionId]: attempt.score }
        scoresRef.current = nextScores
        setScores(nextScores)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setMessage(cause instanceof Error ? cause.message : 'Hasil pronunciation tidak dapat dimuat.')
        }
      })
    return () => controller.abort()
  }, [words])

  useEffect(() => {
    setPlaying(false)
    setAudioError(null)
  }, [word?.id])

  useEffect(() => {
    const blob = mic.audioBlob
    if (!blob || blob === submittedAudio.current || !word || recording) return
    submittedAudio.current = blob
    const controller = new AbortController()
    const submit = async () => {
      setSubmitting(true)
      setResult(null)
      setMessage(null)
      try {
        const idempotencyKey =
          typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${word.id}-${Date.now()}`
        const form = new FormData()
        form.append('questionId', word.id)
        form.append('audio', blob, 'pronunciation.webm')
        const response = await fetch('/api/student/pronunciation', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: form,
          signal: controller.signal,
        })
        const payload = (await response.json()) as { data?: PronunciationResult; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Latihan pronunciation gagal disimpan.')
        if (payload.data.questionId !== word.id || !Array.isArray(payload.data.segments)) {
          throw new Error('Hasil penilaian tidak valid.')
        }
        setResult(payload.data)
        setMessage(payload.data.feedback)
        const nextScores = { ...scoresRef.current, [word.id]: payload.data.score }
        scoresRef.current = nextScores
        setScores(nextScores)
        if (Object.keys(nextScores).length === words.length) setSummaryOpen(true)
        const url = new URL(window.location.href)
        url.searchParams.set('attemptId', payload.data.id)
        window.history.replaceState(null, '', url)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setMessage(cause instanceof Error ? cause.message : 'Penilaian pronunciation gagal. Coba lagi.')
        }
      } finally {
        if (!controller.signal.aborted) setSubmitting(false)
      }
    }
    void submit()
    return () => controller.abort()
  }, [mic.audioBlob, word, recording, words.length])

  const toggleModelAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    audio.currentTime = 0
    void audio.play().catch(() => setAudioError('Browser memblokir pemutaran audio. Tekan tombol sekali lagi.'))
  }, [])

  async function toggleRecord() {
    if (recording) {
      mic.stop()
      setResult(null)
      setMessage('Menilai pelafalan dengan speech recognition…')
      return
    }
    setResult(null)
    setMessage(null)
    setAudioError(null)
    mic.reset()
    submittedAudio.current = null
    await mic.start()
  }

  function go(direction: number) {
    const nextIndex = (index + direction + words.length) % words.length
    setIndex(nextIndex)
    if (words[nextIndex]) {
      const url = new URL(window.location.href)
      url.searchParams.set('questionId', words[nextIndex].id)
      url.searchParams.delete('attemptId')
      window.history.replaceState(null, '', url)
    }
    setResult(null)
    setMessage(null)
    mic.reset()
    submittedAudio.current = null
  }

  function restartLevel() {
    setIndex(0)
    setResult(null)
    setMessage(null)
    setScores({})
    scoresRef.current = {}
    setSummaryOpen(false)
    mic.reset()
    submittedAudio.current = null
  }

  if (!word) return null

  const verdict = result ? VERDICT[result.verdict] : null

  return (
    <div className="mx-auto w-full max-w-[780px]">
      <div className="flex items-center gap-3 border-b border-rule pb-3">
        <MonoLabel className="shrink-0">
          Kata {index + 1} / {words.length}
        </MonoLabel>
        <ol className="flex flex-1 items-center gap-1" aria-label="Progres sesi">
          {words.map((item, itemIndex) => (
            <li
              key={item.id}
              className={cn(
                'h-[3px] flex-1 rounded-[1px]',
                scores[item.id] !== undefined
                  ? 'bg-primary'
                  : itemIndex === index
                    ? 'bg-foreground'
                    : 'bg-border',
              )}
            />
          ))}
        </ol>
        <MonoLabel className="shrink-0">{levelLabel(word.level)}</MonoLabel>
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Ganti level
        </button>
      </div>

      <div className="pt-10 text-center">
        <h2 className="text-balance font-heading text-[52px] font-extrabold leading-[0.95] tracking-[-0.035em] text-foreground sm:text-[68px]">
          {word.word}
        </h2>
        <p className="mt-3 font-mono text-[15px] leading-none text-muted-foreground">{word.ipa}</p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <audio
            key={word.id}
            ref={audioRef}
            src={word.audioUrl}
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setAudioError('Audio model tidak dapat dimuat.')}
            className="hidden"
          />
          <button
            type="button"
            onClick={toggleModelAudio}
            disabled={!word.audioUrl}
            aria-pressed={playing}
            className={cn(
              'inline-flex items-center gap-2 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
              playing
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-rule text-foreground hover:border-foreground/30 hover:bg-secondary',
              !word.audioUrl && 'cursor-not-allowed opacity-50',
            )}
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="size-3.5" aria-hidden="true" />
            )}
            {playing ? 'Hentikan audio' : 'Dengarkan model'}
          </button>
          {audioError ? (
            <p className="max-w-[46ch] text-pretty text-[11px] leading-relaxed text-destructive">{audioError}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-8 border-y border-rule py-3 text-center font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground">
        {word.tip}
      </p>

      <div className="flex flex-col items-center py-8">
        <div className="flex w-full max-w-[420px] items-end justify-center gap-[2px]" aria-hidden="true">
          {(peaks ?? new Array(48).fill(0)).map((peak, peakIndex) => (
            <span
              key={peakIndex}
              className={cn('flex-1 rounded-[1px]', peaks ? 'bg-foreground/70' : 'bg-border')}
              style={{ height: `${Math.max(2, Math.round(peak * 40))}px` }}
            />
          ))}
        </div>
        <div className="mt-2 flex w-full max-w-[420px] items-center justify-between">
          <MonoLabel>{peaks ? 'Rekamanmu' : 'Belum ada rekaman'}</MonoLabel>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {duration ? `${duration.toFixed(2)}s` : '--.--s'}
          </span>
        </div>

        <div className="relative mt-6">
          {recording ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-destructive/25"
              style={{ transform: `scale(${1 + mic.volume * 0.6})` }}
            />
          ) : null}
          <button
            type="button"
            onClick={toggleRecord}
            disabled={mic.status === 'requesting' || submitting}
            aria-label={recording ? 'Hentikan rekaman' : 'Rekam pelafalan'}
            className={cn(
              'relative flex size-16 items-center justify-center rounded-full text-primary-foreground transition-colors disabled:opacity-50',
              recording ? 'bg-destructive' : 'bg-primary hover:bg-primary-deep',
            )}
          >
            {recording ? <Square className="size-5 fill-current" /> : <Mic className="size-6" />}
          </button>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {mic.status === 'requesting'
            ? 'Meminta izin mikrofon'
            : recording
              ? 'Merekam, tekan untuk berhenti'
              : submitting
                ? 'Menilai dengan speech recognition'
                : 'Tekan dan ucapkan satu kata di atas'}
        </p>

        {micBlocked && mic.errorMessage ? (
          <div
            role="alert"
            className="mt-4 flex max-w-[420px] items-start gap-2 border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-destructive"
          >
            {mic.status === 'denied' ? (
              <MicOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="text-pretty">{mic.errorMessage}</span>
          </div>
        ) : null}
      </div>

      {result && verdict ? (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4 border-y border-rule py-4">
            <div>
              <MonoLabel>Skor pelafalan</MonoLabel>
              <p className="mt-2 font-mono text-[44px] font-semibold leading-none tabular-nums text-foreground">
                {result.score}
                <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]', verdict.tone)}>
                <verdict.Icon className="size-3.5" aria-hidden="true" />
                {verdict.label}
              </span>
              <Readout
                label="Sesi"
                value={`${scoredCount}/${words.length}`}
                className="items-end"
              />
            </div>
          </div>

          <Panel>
            <PanelHeader
              label="Yang terdengar"
              right={
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {result.heardWord || 'tidak terdeteksi'}
                </span>
              }
            />
            <p className="px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground">
              {result.transcript || 'Belum ada'}
            </p>
          </Panel>

          {result.segments.length > 0 ? (
            <div>
              <MonoLabel>Perbandingan huruf</MonoLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.segments.map((segment, segmentIndex) => (
                  <span
                    key={`${segment.target}-${segmentIndex}`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[11px]',
                      segment.match
                        ? 'border-rule text-muted-foreground'
                        : 'border-destructive/40 bg-destructive/[0.06] text-destructive',
                    )}
                  >
                    {segment.target || '∅'}
                    {segment.match ? null : (
                      <span className="text-muted-foreground">→ {segment.heard || '∅'}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <Panel tone="sunken">
            <PanelHeader label="Umpan balik" />
            <p className="px-4 py-3 text-pretty text-[12px] leading-relaxed text-muted-foreground">{result.feedback}</p>
          </Panel>

          {mic.audioUrl ? (
            <div>
              <MonoLabel>Rekamanmu</MonoLabel>
              <audio controls src={mic.audioUrl} className="mt-2 h-9 w-full" />
            </div>
          ) : null}
        </div>
      ) : null}

      {message && !result ? (
        <Panel tone="sunken" className="mt-2">
          <PanelHeader label="Belum bisa dinilai" />
          <div className="flex items-start gap-2 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">{message}</p>
          </div>
        </Panel>
      ) : null}

      {complete ? (
        <Panel className="mt-6">
          <PanelHeader
            label={`Sesi ${levelName} selesai`}
            right={
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {scoredCount}/{words.length} kata
              </span>
            }
          />
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4">
            <div>
              <MonoLabel>Rata-rata skor</MonoLabel>
              <p className="mt-2 font-mono text-[36px] font-semibold leading-none tabular-nums text-foreground">
                {average}
                <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={restartLevel} className="gap-1">
                <RotateCcw className="size-3.5" aria-hidden="true" /> Ulangi level
              </Button>
              <Button size="sm" onClick={onExit} className="gap-1">
                Pilih level lain <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="mt-8 flex items-center justify-between border-t border-rule pt-4">
        <Button variant="outline" size="sm" onClick={() => go(-1)} className="gap-1">
          <ChevronLeft className="size-3.5" aria-hidden="true" /> Sebelumnya
        </Button>
        <Button size="sm" onClick={() => go(1)} className="gap-1">
          Selanjutnya <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <ScoreDialog
        open={summaryOpen}
        eyebrow={`Sesi pronunciation ${levelName} selesai`}
        score={average}
        detail={`${scoredCount} kata dinilai`}
        onClose={() => setSummaryOpen(false)}
      />
    </div>
  )
}
