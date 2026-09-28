'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Volume2,
  Mic,
  ChevronLeft,
  ChevronRight,
  Check,
  Square,
  MicOff,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Waveform } from '@/components/dashboard/waveform'
import { useMicrophone } from '@/hooks/use-microphone'
import { cn } from '@/lib/utils'
import type { QuestionBankItem } from '@tuturai/domain'

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
    phonemes: Array<{ phoneme: string; expected: string; actual: string | null; score: number; confidence: number | null; startMs: number; endMs: number; issue: string | null }>
  }>
}

export default function PronunciationPage() {
  const [words, setWords] = useState<QuestionBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [scored, setScored] = useState(false)
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationResult | null>(null)
  const [practiceMessage, setPracticeMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittedAudio = useRef<Blob | null>(null)
  const mic = useMicrophone()
  const word = words[index]

  useEffect(() => {
    fetch('/api/student/question-bank?type=pronunciation&limit=20')
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        setWords(data)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferredIndex = preferredId ? data.findIndex((item) => item.id === preferredId) : -1
        if (preferredIndex >= 0) setIndex(preferredIndex)
      })
      .catch(() => setError('Bank pronunciation belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!words.length) return
    const attemptId = new URLSearchParams(window.location.search).get('attemptId')
    if (!attemptId) return
    const controller = new AbortController()
    fetch(`/api/student/pronunciation?attemptId=${encodeURIComponent(attemptId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { data?: PronunciationResult; error?: { message?: string } }
        if (!response.ok || !payload.data || payload.data.questionId !== word?.id) {
          throw new Error(payload.error?.message ?? 'Hasil pronunciation tidak tersedia untuk latihan ini.')
        }
        setPronunciationResult(payload.data)
        setScored(true)
        setPracticeMessage(payload.data.feedback)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setPracticeMessage(cause instanceof Error ? cause.message : 'Hasil pronunciation tidak dapat dimuat.')
      })
    return () => controller.abort()
  }, [words, word?.id])

  const recording = mic.status === 'recording'
  const micBlocked =
    mic.status === 'denied' || mic.status === 'error' || mic.status === 'unsupported'

  useEffect(() => {
    if (!mic.audioBlob || mic.audioBlob === submittedAudio.current || !word || recording || submitting) return
    submittedAudio.current = mic.audioBlob
    const controller = new AbortController()
    const submit = async () => {
      setSubmitting(true)
      setScored(false)
      setPronunciationResult(null)
      setPracticeMessage(null)
      try {
        const idempotencyKey = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${word.id}-${Date.now()}`
        const form = new FormData()
        form.append('questionId', word.id)
        form.append('audio', mic.audioBlob as Blob, 'pronunciation.webm')
        const response = await fetch('/api/student/pronunciation', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: form,
          signal: controller.signal,
        })
        const payload = await response.json() as { data?: PronunciationResult; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Latihan pronunciation gagal disimpan.')
        if (payload.data.questionId !== word.id || !Array.isArray(payload.data.words) || payload.data.words.length === 0) throw new Error('Hasil phoneme tidak valid.')
        setPronunciationResult(payload.data)
        setScored(true)
        setPracticeMessage(payload.data.feedback)
        const url = new URL(window.location.href)
        url.searchParams.set('attemptId', payload.data.id)
        window.history.replaceState(null, '', url)
      } catch (cause) {
        if (!controller.signal.aborted) setPracticeMessage(cause instanceof Error ? cause.message : 'Penilaian pronunciation gagal. Coba lagi.')
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
      setScored(false)
      setPracticeMessage(null)
      if (word) {
        setPracticeMessage('Memproses pronunciation dengan provider AI...')
      }
    } else {
      setScored(false)
      mic.reset()
      submittedAudio.current = null
      await mic.start()
    }
  }

  function go(dir: number) {
    const nextIndex = (index + dir + words.length) % words.length
    setIndex(nextIndex)
    if (words[nextIndex]) {
      const url = new URL(window.location.href)
      url.searchParams.set('questionId', words[nextIndex].id)
      url.searchParams.delete('attemptId')
      window.history.replaceState(null, '', url)
    }
    setScored(false)
    setPronunciationResult(null)
    setPracticeMessage(null)
    mic.reset()
    submittedAudio.current = null
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pronunciation Lab"
        description="Latih pelafalan kata-kata sulit dan lihat status provider fonetik secara transparan."
      />

      {loading && <Card className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Memuat latihan pronunciation...</Card>}
      {error && <Card className="mx-auto max-w-2xl border-destructive/30 p-6 text-sm text-destructive">{error}</Card>}
      {!loading && !error && words.length === 0 && <Card className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Belum ada latihan pronunciation.</Card>}
      {!loading && !error && word && <div className="mx-auto max-w-2xl">
        <FadeIn>
          <Card className="border-border p-8">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                 Kata {index + 1} / {words.length}
              </Badge>
              <span className="text-xs text-muted-foreground">Tingkat: Menengah</span>
            </div>

            <div className="mt-8 text-center">
              <h2 className="font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {word.word}
              </h2>
              <p className="mt-2 font-mono text-lg text-muted-foreground">{word.ipa}</p>
               <button onClick={() => {
                 if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(word.word))
               }} className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
                <Volume2 className="h-4 w-4" /> Dengarkan contoh
              </button>
            </div>

            <div className="mt-8 rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">{word.tip}</p>
            </div>

            <div className="mt-8 flex flex-col items-center">
              <Waveform
                active={recording}
                levels={recording ? mic.levels : undefined}
                className="mb-4 w-full max-w-sm"
              />
              <button
                onClick={toggleRecord}
                disabled={mic.status === 'requesting'}
                className={cn(
                  'relative flex h-16 w-16 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-70',
                  recording ? 'bg-rose-500' : 'bg-primary',
                )}
                aria-label={recording ? 'Hentikan rekaman' : 'Rekam pelafalan'}
              >
                {recording && (
                  <span
                    className="absolute inset-0 rounded-full bg-rose-500/40 animate-pulse-ring"
                    style={{ transform: `scale(${1 + mic.volume * 0.8})` }}
                  />
                )}
                {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
              </button>
              <p className="mt-3 text-sm text-muted-foreground">
                {mic.status === 'requesting'
                  ? 'Meminta izin mikrofon…'
                  : recording
                    ? 'Sedang mendengarkan… tekan untuk berhenti'
                    : 'Tekan & ucapkan kata di atas'}
              </p>

              {micBlocked && mic.errorMessage && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {mic.status === 'denied' ? (
                    <MicOff className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span className="text-pretty leading-relaxed">{mic.errorMessage}</span>
                </div>
              )}
            </div>

             {scored && (
                <FadeIn className="mt-6 rounded-xl border border-success/30 bg-success/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-success">
                      <Check className="h-4 w-4" /> Hasil provider tersimpan
                    </span>
                     <span className="font-mono text-sm font-bold text-foreground">{pronunciationResult?.score}/100</span>
                  </div>
                   <p className="mt-2 text-sm text-muted-foreground">{pronunciationResult?.feedback}</p>
                   <p className="mt-2 text-sm text-foreground">Transkrip: {pronunciationResult?.transcript}</p>
                   <p className="mt-1 text-xs text-muted-foreground">Confidence: {pronunciationResult?.confidence === null ? 'tidak tersedia' : `${Math.round((pronunciationResult?.confidence ?? 0) * 100)}%`}</p>
                   <ul className="mt-4 space-y-3">{pronunciationResult?.words.map((resultWord) => <li key={`${resultWord.expected}-${resultWord.phonemes[0]?.startMs ?? 0}`} className="rounded-lg border border-success/20 bg-background/60 p-3">
                     <div className="flex items-center justify-between gap-3"><span className="font-medium text-foreground">{resultWord.expected} <span className="text-muted-foreground">→ {resultWord.actual}</span></span><span className="font-mono text-sm font-semibold text-foreground">{resultWord.score}/100</span></div>
                     <ul className="mt-2 flex flex-wrap gap-2">{resultWord.phonemes.map((phoneme, phonemeIndex) => <li key={`${phoneme.phoneme}-${phonemeIndex}`} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"><span className="font-mono text-foreground">/{phoneme.expected}/</span> → {phoneme.actual ? `/${phoneme.actual}/` : 'tidak terdeteksi'} · {phoneme.score}/100{phoneme.issue ? ` · ${phoneme.issue}` : ''}</li>)}</ul>
                   </li>)}</ul>
                  {mic.audioUrl && (
                    <audio controls src={mic.audioUrl} className="mt-3 h-9 w-full" />
                 )}
               </FadeIn>
             )}
      {practiceMessage && !scored && <p role="status" className="mt-4 text-sm text-destructive">{practiceMessage}</p>}

            <div className="mt-8 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => go(-1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Sebelumnya
              </Button>
              <Button size="sm" onClick={() => go(1)} className="gap-1">
                Selanjutnya <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </FadeIn>
      </div>}
    </div>
  )
}
