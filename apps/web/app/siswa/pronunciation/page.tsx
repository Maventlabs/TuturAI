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

export default function PronunciationPage() {
  const [words, setWords] = useState<QuestionBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [scored, setScored] = useState(false)
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
      setPracticeMessage(null)
      try {
        const idempotencyKey = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${word.id}-${Date.now()}`
        const response = await fetch('/api/student/practice-attempts', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify({ questionId: word.id, contentType: 'pronunciation', idempotencyKey }),
          signal: controller.signal,
        })
        const payload = await response.json() as { data?: { assessmentStatus?: string; score?: number | null }; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Latihan pronunciation gagal disimpan.')
        if (payload.data.assessmentStatus !== 'provider_unavailable' || payload.data.score !== null) throw new Error('Hasil pronunciation tidak valid.')
        setScored(true)
        setPracticeMessage('Latihan tercatat. Skor pronunciation tersedia setelah provider fonetik dikonfigurasi.')
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
    setIndex((i) => (i + dir + words.length) % words.length)
    setScored(false)
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
                     <Check className="h-4 w-4" /> Latihan tercatat
                   </span>
                    <span className="font-mono text-sm font-bold text-foreground">Provider belum tersedia</span>
                 </div>
                  <p className="mt-2 text-sm text-muted-foreground">{practiceMessage}</p>
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
