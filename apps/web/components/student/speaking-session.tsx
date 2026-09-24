'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Square,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Volume2,
  MicOff,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Waveform } from '@/components/dashboard/waveform'
import { ProgressRing } from '@/components/dashboard/progress-ring'
import { SKILL_LABELS, type SkillKey } from '@/lib/skills'
import { useMicrophone } from '@/hooks/use-microphone'
import { cn } from '@/lib/utils'
import type { Assessment } from '@tuturai/domain'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'

type Phase = 'idle' | 'recording' | 'analyzing' | 'result'

export function SpeakingSession({ topic, questionId }: { topic: string; questionId: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const mic = useMicrophone()
  useEffect(() => {
    if (phase !== 'analyzing' || !mic.audioBlob) return
    const controller = new AbortController()
    const submit = async () => {
        const form = new FormData()
        form.append('sessionId', crypto.randomUUID())
        form.append('questionId', questionId)
      form.append('audio', mic.audioBlob as Blob, 'speaking.webm')
      try {
        const response = await fetch('/api/student/assessment', { method: 'POST', body: form, signal: controller.signal })
        const payload = (await response.json()) as { data?: Assessment; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Analisis gagal dilakukan.')
         setAssessment(payload.data)
         setShowCompletion(true)
         setPhase('result')
      } catch (error) {
        if (!controller.signal.aborted) {
          setAnalysisError(error instanceof Error ? error.message : 'Analisis gagal dilakukan.')
          setPhase('idle')
        }
      }
    }
    void submit()
    return () => controller.abort()
  }, [phase, mic.audioBlob, questionId])

  async function startRecording() {
    mic.reset()
    await mic.start()
    setPhase('recording')
  }

  function stopRecording() {
    mic.stop()
    setPhase('analyzing')
    setAnalysisError(null)
  }

  function reset() {
    mic.reset()
    setAssessment(null)
    setShowCompletion(false)
    setAnalysisError(null)
    setPhase('idle')
  }

  function reportExampleAudioUnavailable() {
    setAnalysisError('Audio contoh belum tersedia karena provider TTS belum dikonfigurasi.')
  }

  // If the recording phase is active but the mic was denied/errored, surface it.
  const micBlocked =
    mic.status === 'denied' || mic.status === 'error' || mic.status === 'unsupported'

  // Keep the phase in sync if permission is denied right after pressing record.
  useEffect(() => {
    if (phase === 'recording' && micBlocked) {
      setPhase('idle')
    }
  }, [phase, micBlocked])

  const feedback: { skill: SkillKey; score: number; note: string }[] = assessment
    ? [
        { skill: 'pronunciation', score: assessment.pronunciation, note: 'Hasil dari analisis provider.' },
        { skill: 'grammar', score: assessment.grammar, note: 'Hasil dari analisis provider.' },
        { skill: 'fluency', score: assessment.fluency, note: 'Hasil dari analisis provider.' },
        { skill: 'vocabulary', score: assessment.vocabulary, note: 'Hasil dari analisis provider.' },
        { skill: 'intonation', score: assessment.intonation, note: 'Hasil dari analisis provider.' },
      ]
    : []
  const overall = assessment?.overall ?? 0

  const seconds = mic.seconds

  return (
    <Card className="overflow-hidden border-border">
      <div className="border-b border-border bg-muted/40 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> {topic}
            </Badge>
            <Badge variant="outline">AI Tutor</Badge>
          </div>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Prompt */}
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={reportExampleAudioUnavailable}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              aria-label="Putar contoh audio"
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pertanyaan
              </p>
              <p className="mt-1 text-pretty text-base font-medium leading-relaxed text-foreground">
                Explain your experience with {topic} in complete English sentences.
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {(phase === 'idle' || phase === 'recording') && (
            <motion.div
              key="record"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <Waveform
                active={phase === 'recording'}
                levels={phase === 'recording' ? mic.levels : undefined}
                className="mb-6 w-full max-w-md"
              />
              <div className="relative">
                {phase === 'recording' && (
                  <span
                    className="absolute inset-0 rounded-full bg-rose-500/40 animate-pulse-ring"
                    style={{ transform: `scale(${1 + mic.volume * 0.8})` }}
                  />
                )}
                <button
                  onClick={phase === 'recording' ? stopRecording : startRecording}
                  disabled={mic.status === 'requesting'}
                  className={cn(
                    'relative flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-70',
                    phase === 'recording' ? 'bg-rose-500' : 'bg-primary',
                  )}
                  aria-label={phase === 'recording' ? 'Hentikan rekaman' : 'Mulai rekaman'}
                >
                  {phase === 'recording' ? (
                    <Square className="h-7 w-7 fill-current" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </button>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                {mic.status === 'requesting'
                  ? 'Meminta izin mikrofon…'
                  : phase === 'recording'
                    ? 'Sedang merekam… tekan untuk berhenti'
                    : 'Tekan tombol untuk mulai berbicara'}
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
              {analysisError && (
                <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-pretty leading-relaxed">{analysisError}</span>
                </div>
              )}
            </motion.div>
          )}

          {phase === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-6"
            >
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
                <Sparkles className="h-9 w-9 text-primary" />
              </div>
              <p className="mt-5 text-sm font-medium text-foreground">
                AI sedang menganalisis ucapanmu…
              </p>
               <p className="mt-4 text-xs text-muted-foreground">Rekaman dikirim ke provider AI. Jangan tutup halaman ini.</p>
             </motion.div>
          )}

          {phase === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-6 sm:flex-row sm:gap-6">
                <ProgressRing value={overall} size={120} label={String(overall)} sublabel="Skor" />
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-bold text-foreground">Kerja bagus!</h3>
                  <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {assessment?.feedback}
                  </p>
                  <p className="mt-2 text-sm text-foreground">{assessment?.transcript}</p>
                  {mic.audioUrl && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Rekamanmu
                      </p>
                      <audio
                        controls
                        src={mic.audioUrl}
                        className="h-9 w-full max-w-xs"
                      />
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                     <Badge variant="secondary">
                       Confidence {assessment?.confidence === null ? 'n/a' : `${Math.round((assessment?.confidence ?? 0) * 100)}%`}
                     </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {feedback.map((f) => (
                  <div key={f.skill} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {SKILL_LABELS[f.skill]}
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                        {f.score}
                      </span>
                    </div>
                    <Progress value={f.score} className="my-2" />
                    <p className="text-xs leading-relaxed text-muted-foreground">{f.note}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={reset} variant="outline" className="flex-1 gap-2">
                  <RotateCcw className="h-4 w-4" /> Coba pertanyaan lain
                </Button>
                 <Button className="flex-1 gap-2" onClick={reset}>
                  Lanjut latihan <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <CompletionDialog
        open={showCompletion && phase === 'result' && assessment !== null}
        title={overall >= 80 ? 'Speaking mantap!' : 'Speaking selesai'}
        message="Analisis speaking sudah dikonfirmasi tersimpan oleh server."
        score={`${overall}/100`}
        detail={assessment?.feedback ?? 'Hasil analisis tersedia di sesi ini.'}
        onClose={() => setShowCompletion(false)}
      />
    </Card>
  )
}
