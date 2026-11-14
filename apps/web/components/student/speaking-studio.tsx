'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Keyboard, Mic, MicOff, RotateCcw, Square, Volume2 } from 'lucide-react'
import type { Assessment, QuestionBankItem } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { useMicrophone } from '@/hooks/use-microphone'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { cn } from '@/lib/utils'
import {
  DimensionBar,
  MonoLabel,
  Panel,
  PanelHeader,
  Readout,
  StatusLine,
} from '@/components/student/practice/practice-ui'

type Phase = 'idle' | 'recording' | 'analyzing' | 'result'

type MetricStatus = 'complete' | 'partial' | 'pending' | 'insufficient_evidence' | 'failed'

type AssessmentResponse = Assessment & { metricStatuses?: Record<string, MetricStatus> }

const DIMENSIONS = [
  { key: 'pronunciation', label: 'Pelafalan' },
  { key: 'fluency', label: 'Kelancaran' },
  { key: 'intonation', label: 'Intonasi' },
  { key: 'grammar', label: 'Tata bahasa' },
  { key: 'vocabulary', label: 'Kosakata' },
] as const

function clock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function SpeakingStudio({
  topics,
  activeTopicId,
  onSelectTopic,
}: {
  topics: QuestionBankItem[]
  activeTopicId: string
  onSelectTopic: (id: string) => void
}) {
  const topic = topics.find((item) => item.id === activeTopicId) ?? topics[0]
  const [phase, setPhase] = useState<Phase>('idle')
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzingSeconds, setAnalyzingSeconds] = useState(0)
  const [typedTranscript, setTypedTranscript] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerDraft, setComposerDraft] = useState('')
  const submittedRef = useRef<string | null>(null)
  const mic = useMicrophone()
  const speech = useSpeechRecognition('en-US')

  const recording = phase === 'recording'
  const micBlocked = mic.status === 'denied' || mic.status === 'error' || mic.status === 'unsupported'
  const spokenTranscript = typedTranscript ?? speech.result?.transcript ?? null
  const spokenSeconds = Math.round((speech.result?.durationMs ?? mic.seconds * 1000) / 1000)

  useEffect(() => {
    if (phase !== 'analyzing') {
      setAnalyzingSeconds(0)
      return
    }
    const id = window.setInterval(() => setAnalyzingSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'analyzing') return
    const transcript = typedTranscript ?? speech.result?.transcript
    const audioBlob = mic.audioBlob
    if (!transcript && !audioBlob) return
    const signature = `${topic.id}:${transcript ?? 'audio'}:${audioBlob?.size ?? 0}`
    if (submittedRef.current === signature) return
    submittedRef.current = signature

    const controller = new AbortController()
    const submit = async () => {
      const form = new FormData()
      form.append('sessionId', crypto.randomUUID())
      form.append('questionId', topic.id)
      if (transcript) {
        form.append('transcript', transcript)
        form.append('spokenDurationMs', String(speech.result?.durationMs ?? Math.max(1000, mic.seconds * 1000)))
        form.append('transcriptSource', 'browser_speech_api')
      } else {
        form.append('audio', audioBlob as Blob, 'speaking.webm')
      }
      try {
        const response = await fetch('/api/student/assessment', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        })
        const payload = (await response.json()) as { data?: AssessmentResponse; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Analisis gagal dilakukan.')
        setAssessment(payload.data)
        setPhase('result')
      } catch (error) {
        if (controller.signal.aborted) return
        submittedRef.current = null
        setAnalysisError(error instanceof Error ? error.message : 'Analisis gagal dilakukan.')
        setPhase('idle')
      }
    }
    void submit()
    return () => controller.abort()
  }, [phase, typedTranscript, speech.result, mic.audioBlob, mic.seconds, topic.id])

  useEffect(() => {
    if (phase === 'recording' && micBlocked) setPhase('idle')
  }, [phase, micBlocked])

  async function startRecording() {
    mic.reset()
    speech.reset()
    setAssessment(null)
    setAnalysisError(null)
    setTypedTranscript(null)
    submittedRef.current = null
    if (speech.supported) speech.start()
    await mic.start()
    setPhase('recording')
  }

  function stopRecording() {
    mic.stop()
    if (speech.status === 'listening') speech.stop()
    queueMicrotask(() => setPhase('analyzing'))
  }

  function reset() {
    mic.reset()
    speech.reset()
    setAssessment(null)
    setAnalysisError(null)
    setTypedTranscript(null)
    setComposerOpen(false)
    setComposerDraft('')
    submittedRef.current = null
    setPhase('idle')
  }

  function submitTyped() {
    const value = composerDraft.trim()
    if (value.length < 3) return
    setTypedTranscript(value)
    setComposerOpen(false)
    setAnalysisError(null)
    setPhase('analyzing')
  }

  const turns = useMemo(() => {
    const list: Array<{ id: string; index: string; at: string; speaker: 'ai' | 'kamu'; text: string; muted?: boolean }> = [
      {
        id: 'task',
        index: '01',
        at: '00:00',
        speaker: 'ai',
        text: topic.prompt,
      },
    ]
    if (spokenTranscript) {
      list.push({
        id: 'answer',
        index: '02',
        at: clock(spokenSeconds),
        speaker: 'kamu',
        text: spokenTranscript,
      })
    } else if (recording) {
      list.push({
        id: 'answer',
        index: '02',
        at: clock(mic.seconds),
        speaker: 'kamu',
        text: 'Sedang merekam…',
        muted: true,
      })
    } else {
      list.push({
        id: 'answer',
        index: '02',
        at: '--:--',
        speaker: 'kamu',
        text: 'Belum ada ucapan pada sesi ini.',
        muted: true,
      })
    }
    if (assessment?.feedback) {
      list.push({
        id: 'feedback',
        index: '03',
        at: clock(spokenSeconds + 1),
        speaker: 'ai',
        text: assessment.feedback,
      })
    }
    return list
  }, [topic.prompt, spokenTranscript, spokenSeconds, recording, mic.seconds, assessment])

  const statusTone = recording ? 'live' : phase === 'analyzing' ? 'busy' : analysisError ? 'error' : 'idle'
  const statusText =
    phase === 'recording'
      ? 'Mendengarkan'
      : phase === 'analyzing'
        ? analyzingSeconds < 3
          ? 'Memproses ucapan'
          : 'Menyiapkan suara guru'
        : phase === 'result'
          ? 'Sesi selesai'
          : 'Siap merekam'

  const showTextFallback = !speech.supported || analyzingSeconds >= 10 || (phase === 'idle' && micBlocked)

  const signalPanel = (
    <div className="flex flex-col">
      <PanelHeader
        label="Panel sinyal"
        right={<span className="font-mono text-[10px] tabular-nums text-muted-foreground">{clock(recording ? mic.seconds : spokenSeconds)}</span>}
      />
      <div className="border-b border-rule px-4 py-4">
        <div className="flex h-16 items-end gap-[3px]" aria-hidden="true">
          {mic.levels.map((level, index) => (
            <span
              key={index}
              className={cn(
                'flex-1 rounded-[1px] transition-[height] duration-75',
                recording ? 'bg-primary' : 'bg-border',
              )}
              style={{ height: `${Math.max(3, Math.round((recording ? level : 0.06) * 64))}px` }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <StatusLine tone={statusTone}>{statusText}</StatusLine>
          {phase === 'analyzing' ? (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{analyzingSeconds}s</span>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-rule border-b border-rule">
        <div className="px-4 py-3">
          <Readout label="Durasi" value={clock(recording ? mic.seconds : spokenSeconds)} />
        </div>
        <div className="px-4 py-3">
          <Readout label="Level" value={topic.level === 'beginner' ? 'Pemula' : topic.level === 'intermediate' ? 'Menengah' : 'Lanjutan'} />
        </div>
      </dl>

      {assessment ? (
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <MonoLabel>Lima dimensi</MonoLabel>
            <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
              {assessment.overall}
              <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">/100</span>
            </span>
          </div>
          {DIMENSIONS.map((dimension) => {
            const status = assessment.metricStatuses?.[dimension.key]
            const insufficient =
              status === 'insufficient_evidence' ||
              status === 'failed' ||
              (!assessment.metricStatuses && (dimension.key === 'pronunciation' || dimension.key === 'intonation') && !mic.audioBlob)
            return (
              <DimensionBar
                key={dimension.key}
                label={dimension.label}
                value={assessment[dimension.key]}
                status={insufficient ? 'insufficient' : 'scored'}
              />
            )
          })}
          <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
            Dimensi bertanda “Butuh bukti audio” tidak dihitung dari teks. Rekam suara agar bisa dinilai.
          </p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <MonoLabel>Catatan</MonoLabel>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Transkrip dari browser hanya dinilai pada tata bahasa, kosakata, dan kelancaran. Pelafalan dan intonasi
            butuh audio asli.
          </p>
        </div>
      )}
    </div>
  )

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px] lg:divide-x lg:divide-rule">
      <div className="min-w-0 lg:pr-6">
        <div className="border-b border-rule">
          <div className="flex items-center justify-between gap-3 pb-2">
            <MonoLabel>Skenario</MonoLabel>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {topics.findIndex((item) => item.id === topic.id) + 1}/{topics.length}
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Pilih skenario speaking"
            className="-mx-1 flex snap-x overflow-x-auto rounded-sm border border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {topics.map((item) => {
              const active = item.id === topic.id
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (item.id === topic.id) return
                    reset()
                    onSelectTopic(item.id)
                  }}
                  className={cn(
                    'shrink-0 snap-start border-r border-rule px-3 py-2.5 font-mono text-[10px] uppercase leading-none tracking-[0.14em] transition-colors last:border-r-0',
                    active
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {item.word ?? item.prompt.slice(0, 24)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 border-y border-r border-rule border-l-2 border-l-primary bg-card px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <MonoLabel className="text-primary-deep">Tugas dari AI</MonoLabel>
            <button
              type="button"
              onClick={() => setAnalysisError('Audio model belum tersedia karena provider TTS belum dikonfigurasi.')}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Volume2 className="size-3" aria-hidden="true" /> Dengar
            </button>
          </div>
          <p className="mt-2 text-pretty text-[15px] leading-[1.65] text-foreground">{topic.prompt}</p>
        </div>

        <ol className="mt-4 divide-y divide-rule border-y border-rule">
          {turns.map((turn) => (
            <li key={turn.id} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] leading-none tabular-nums text-foreground">{turn.index}</span>
                <span className="font-mono text-[9px] leading-none tabular-nums text-muted-foreground">{turn.at}</span>
              </div>
              <div className="min-w-0">
                <MonoLabel className={turn.speaker === 'ai' ? 'text-primary-deep' : 'text-foreground'}>
                  {turn.speaker === 'ai' ? 'AI Tutor' : 'Kamu'}
                </MonoLabel>
                <p
                  className={cn(
                    'mt-2 text-pretty text-[15px] leading-[1.7]',
                    turn.muted ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {turn.text}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {composerOpen ? (
          <div className="mt-4 border border-rule bg-card">
            <PanelHeader label="Kirim teks" />
            <div className="p-3">
              <label htmlFor="speaking-composer" className="sr-only">
                Tulis jawabanmu dalam bahasa Inggris
              </label>
              <textarea
                id="speaking-composer"
                value={composerDraft}
                onChange={(event) => setComposerDraft(event.target.value)}
                rows={4}
                placeholder="Tulis apa yang kamu ucapkan, dalam bahasa Inggris."
                className="w-full resize-y rounded-sm border border-rule bg-background px-3 py-2 text-[14px] leading-relaxed text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Transkrip teks tidak bisa dinilai untuk pelafalan dan intonasi.
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setComposerOpen(false)}>
                    Batal
                  </Button>
                  <Button size="sm" onClick={submitTyped} disabled={composerDraft.trim().length < 3}>
                    Kirim
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {analysisError ? (
          <div role="alert" className="mt-4 flex items-start gap-2 border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-pretty">{analysisError}</span>
          </div>
        ) : null}

        {micBlocked && mic.errorMessage ? (
          <div role="alert" className="mt-4 flex items-start gap-2 border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-destructive">
            {mic.status === 'denied' ? (
              <MicOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="text-pretty">{mic.errorMessage}</span>
          </div>
        ) : null}

        <div className="sticky bottom-20 z-10 mt-4 border-t border-rule bg-card/95 py-3 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {recording ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-destructive/25"
                  style={{ transform: `scale(${1 + mic.volume * 0.6})` }}
                />
              ) : null}
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={mic.status === 'requesting' || phase === 'analyzing'}
                aria-label={recording ? 'Hentikan rekaman' : 'Mulai merekam'}
                className={cn(
                  'relative flex size-14 items-center justify-center rounded-full text-primary-foreground transition-colors disabled:opacity-50',
                  recording ? 'bg-destructive' : 'bg-primary hover:bg-primary-deep',
                )}
              >
                {recording ? <Square className="size-5 fill-current" /> : <Mic className="size-6" />}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-foreground">
                {recording ? 'Merekam' : phase === 'analyzing' ? 'Memproses' : phase === 'result' ? 'Selesai' : 'Siap'}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                {mic.status === 'requesting'
                  ? 'Meminta izin mikrofon…'
                  : recording
                    ? 'Tekan untuk berhenti. Bicara dalam kalimat lengkap.'
                    : phase === 'analyzing'
                      ? 'Rekaman dikirim ke provider AI. Jangan tutup halaman ini.'
                      : phase === 'result'
                        ? 'Baca ringkasan di panel sinyal, lalu ulangi bila perlu.'
                        : 'Tekan tombol untuk mulai berbicara.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {phase === 'result' ? (
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                  <RotateCcw className="size-3.5" aria-hidden="true" /> Ulangi
                </Button>
              ) : null}
              {showTextFallback && phase !== 'result' ? (
                <Button variant="outline" size="sm" onClick={() => setComposerOpen(true)} className="gap-1.5">
                  <Keyboard className="size-3.5" aria-hidden="true" /> Kirim teks
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <aside className="mt-6 lg:mt-0 lg:pl-6">
        <div className="lg:hidden">
          <details className="group border border-rule bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <MonoLabel>Panel sinyal</MonoLabel>
              <StatusLine tone={statusTone}>{statusText}</StatusLine>
            </summary>
            <div className="border-t border-rule">{signalPanel}</div>
          </details>
        </div>
        <div className="hidden lg:block">
          <Panel className="overflow-hidden">{signalPanel}</Panel>
        </div>
      </aside>
    </div>
  )
}
