'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Mic, MicOff, Minus, Square, Volume2 } from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { useMicrophone } from '@/hooks/use-microphone'
import { useAudioPeaks } from '@/hooks/use-audio-peaks'
import { cn } from '@/lib/utils'
import { MonoLabel, Panel, PanelHeader, Readout } from '@/components/student/practice/practice-ui'

type PronunciationResult = {
  id: string
  questionId: string
  targetText: string
  transcript: string
  score: number
  confidence: number | null
  feedback: string
  words: Array<{
    word: string
    expected: string
    actual: string
    score: number
    confidence: number | null
    phonemes: Array<{
      phoneme: string
      expected: string
      actual: string | null
      score: number
      confidence: number | null
      startMs: number
      endMs: number
      issue: string | null
    }>
  }>
}

function verdict(score: number) {
  if (score >= 85) return { label: 'Tepat', Icon: Check, tone: 'text-success' as const }
  if (score >= 70) return { label: 'Hampir', Icon: Minus, tone: 'text-warning' as const }
  return { label: 'Kurang tegas', Icon: AlertTriangle, tone: 'text-destructive' as const }
}

function levelLabel(level: QuestionBankItem['level']) {
  return level === 'beginner' ? 'Pemula' : level === 'intermediate' ? 'Menengah' : 'Lanjutan'
}

export function PronunciationLab({ words, initialIndex }: { words: QuestionBankItem[]; initialIndex: number }) {
  const [index, setIndex] = useState(initialIndex)
  const [result, setResult] = useState<PronunciationResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [modelAudioNote, setModelAudioNote] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState(0)
  const submittedAudio = useRef<Blob | null>(null)
  const mic = useMicrophone()
  const { peaks, duration } = useAudioPeaks(mic.audioUrl)
  const word = words[index]
  const recording = mic.status === 'recording'
  const micBlocked = mic.status === 'denied' || mic.status === 'error' || mic.status === 'unsupported'

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
        if (!response.ok || !payload.data || payload.data.questionId !== word?.id) {
          throw new Error(payload.error?.message ?? 'Hasil pronunciation tidak tersedia untuk latihan ini.')
        }
        setResult(payload.data)
        setMessage(payload.data.feedback)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setMessage(cause instanceof Error ? cause.message : 'Hasil pronunciation tidak dapat dimuat.')
        }
      })
    return () => controller.abort()
  }, [words, word?.id])

  useEffect(() => {
    if (!mic.audioBlob || mic.audioBlob === submittedAudio.current || !word || recording || submitting) return
    submittedAudio.current = mic.audioBlob
    const controller = new AbortController()
    const submit = async () => {
      setSubmitting(true)
      setResult(null)
      setMessage(null)
      setSelectedWord(0)
      try {
        const idempotencyKey =
          typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${word.id}-${Date.now()}`
        const form = new FormData()
        form.append('questionId', word.id)
        form.append('audio', mic.audioBlob as Blob, 'pronunciation.webm')
        const response = await fetch('/api/student/pronunciation', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: form,
          signal: controller.signal,
        })
        const payload = (await response.json()) as { data?: PronunciationResult; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Latihan pronunciation gagal disimpan.')
        if (payload.data.questionId !== word.id || !Array.isArray(payload.data.words) || payload.data.words.length === 0) {
          throw new Error('Hasil phoneme tidak valid.')
        }
        setResult(payload.data)
        setMessage(payload.data.feedback)
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
  }, [mic.audioBlob, word, recording, submitting])

  async function toggleRecord() {
    if (recording) {
      mic.stop()
      setResult(null)
      setMessage('Memproses pronunciation dengan provider AI…')
      return
    }
    setResult(null)
    setMessage(null)
    setModelAudioNote(null)
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
    setModelAudioNote(null)
    setSelectedWord(0)
    mic.reset()
    submittedAudio.current = null
  }

  if (!word) return null

  const activeWord = result?.words[selectedWord] ?? null
  const scored = result !== null

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
                itemIndex < index ? 'bg-primary' : itemIndex === index ? 'bg-foreground' : 'bg-border',
              )}
            />
          ))}
        </ol>
        <MonoLabel className="shrink-0">{levelLabel(word.level)}</MonoLabel>
      </div>

      <div className="pt-10 text-center">
        <h2 className="text-balance font-heading text-[52px] font-extrabold leading-[0.95] tracking-[-0.035em] text-foreground sm:text-[68px]">
          {word.word}
        </h2>
        <p className="mt-3 font-mono text-[15px] leading-none text-muted-foreground">{word.ipa}</p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setModelAudioNote(
                'Audio model belum tersedia karena provider TTS belum dikonfigurasi. Suara sintetis browser tidak dipakai sebagai pengganti.',
              )
            }
            className="inline-flex items-center gap-2 rounded-sm border border-rule px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-foreground/30 hover:bg-secondary"
          >
            <Volume2 className="size-3.5" aria-hidden="true" /> Dengarkan model
          </button>
          {modelAudioNote ? (
            <p className="max-w-[46ch] text-pretty text-[11px] leading-relaxed text-muted-foreground">{modelAudioNote}</p>
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
              ? 'Merekam — tekan untuk berhenti'
              : submitting
                ? 'Menilai dengan provider'
                : 'Tekan dan ucapkan kata di atas'}
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

      {scored ? (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4 border-y border-rule py-4">
            <div>
              <MonoLabel>Skor provider</MonoLabel>
              <p className="mt-2 font-mono text-[44px] font-semibold leading-none tabular-nums text-foreground">
                {result.score}
                <span className="ml-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="text-right">
              <Readout
                label="Confidence"
                value={result.confidence === null ? 'n/a' : `${Math.round(result.confidence * 100)}%`}
                className="items-end"
              />
            </div>
          </div>

          <Panel>
            <PanelHeader label="Yang terdengar" />
            <p className="px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground">
              {result.transcript || '—'}
            </p>
          </Panel>

          <div>
            <MonoLabel>Umpan balik per kata</MonoLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.words.map((entry, entryIndex) => {
                const { label, Icon, tone } = verdict(entry.score)
                const active = entryIndex === selectedWord
                return (
                  <button
                    key={`${entry.expected}-${entryIndex}`}
                    type="button"
                    onClick={() => setSelectedWord(entryIndex)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 transition-colors',
                      active ? 'border-foreground/40 bg-secondary' : 'border-rule hover:border-foreground/25',
                    )}
                  >
                    <Icon className={cn('size-3.5 shrink-0', tone)} aria-hidden="true" />
                    <span className="font-mono text-[11px] text-foreground">{entry.expected}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {activeWord ? (
            <Panel>
              <PanelHeader
                label={`Fonem — ${activeWord.expected}`}
                right={
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {activeWord.score}/100
                  </span>
                }
              />
              <ul className="divide-y divide-rule">
                {activeWord.phonemes.map((phoneme, phonemeIndex) => {
                  const { label, Icon, tone } = verdict(phoneme.score)
                  return (
                    <li
                      key={`${phoneme.phoneme}-${phonemeIndex}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className={cn('size-3.5 shrink-0', tone)} aria-hidden="true" />
                        <span className="font-mono text-[12px] text-foreground">/{phoneme.expected}/</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          → {phoneme.actual ? `/${phoneme.actual}/` : 'tidak terdeteksi'}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {label}
                        {phoneme.issue ? ` · ${phoneme.issue}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          ) : null}

          {mic.audioUrl ? (
            <div>
              <MonoLabel>Rekamanmu</MonoLabel>
              <audio controls src={mic.audioUrl} className="mt-2 h-9 w-full" />
            </div>
          ) : null}
        </div>
      ) : null}

      {message && !scored ? (
        <Panel tone="sunken" className="mt-2">
          <PanelHeader label="Belum bisa dinilai" />
          <div className="flex items-start gap-2 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">{message}</p>
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
    </div>
  )
}
