'use client'

import { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, Headphones, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { QuestionBankItem } from '@tuturai/domain'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'

export default function ListeningPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [results, setResults] = useState<(boolean | null)[]>([])
  const [correctOptions, setCorrectOptions] = useState<(number | null)[]>([])
  const [attemptIds, setAttemptIds] = useState<string[]>([])
  const [masteredIds, setMasteredIds] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const correct = results.filter(Boolean).length

  useEffect(() => {
    fetch('/api/student/question-bank?type=listening&limit=20')
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[]; masteredIds?: string[] }>
      })
      .then((payload) => {
        const rawData = payload.data ?? []
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferred = preferredId ? rawData.find((item) => item.id === preferredId) : undefined
        const data = preferred ? [preferred, ...rawData.filter((item) => item.id !== preferred.id)] : rawData
        setQuestions(data)
        setAnswers(data.map(() => null))
        setResults(data.map(() => null))
        setCorrectOptions(data.map(() => null))
        setAttemptIds(data.map(() => crypto.randomUUID()))
        setMasteredIds(payload.masteredIds ?? [])
      })
      .catch(() => setError('Listening practice belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  function choose(qi: number, oi: number) {
    if (submitted || !questions[qi]) return
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Listening Comprehension"
        description="Dengarkan percakapan dan uji pemahamanmu melalui pertanyaan."
      />

      {loading && <Card className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Memuat latihan listening...</Card>}
      {error && <Card className="mx-auto max-w-2xl border-destructive/30 p-6 text-sm text-destructive">{error}</Card>}
      {!loading && !error && questions.length === 0 && <Card className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Belum ada latihan listening.</Card>}
      {!loading && !error && questions.length > 0 && <div className="mx-auto max-w-2xl space-y-6">
        <FadeIn>
          <Card className="border-border p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Headphones className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Listening practice</p>
                <p className="text-xs text-muted-foreground">Teks audio dibacakan melalui browser</p>
              </div>
              <Badge variant="secondary">Audio</Badge>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button
                size="icon"
                onClick={() => {
                  setPlaying((p) => !p)
                  if (!playing && questions[0]?.audioText && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel()
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(questions[0].audioText))
                  } else if (playing && 'speechSynthesis' in window) window.speechSynthesis.cancel()
                }}
                aria-label={playing ? 'Jeda' : 'Putar'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Browser speech playback</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (questions[0]?.audioText && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel()
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(questions[0].audioText))
                  }
                }}
                aria-label="Ulang"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </FadeIn>

        <FadeIn className="space-y-4">
          {questions.map((item, qi) => (
                   <Card key={qi} className="border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {qi + 1}. {item.prompt}
                </p>
                {masteredIds.includes(item.id) && <Badge variant="secondary">Sudah dikuasai</Badge>}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.options.map((opt, oi) => {
                  const selected = answers[qi] === oi
                  const isCorrect = oi === correctOptions[qi]
                  const showState = submitted && (selected || isCorrect)
                  return (
                    <button
                      key={oi}
                      onClick={() => choose(qi, oi)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                        !submitted && selected && 'border-primary bg-primary/5',
                        !submitted && !selected && 'border-border hover:border-primary/40',
                        showState && isCorrect && 'border-success bg-success/10 text-success',
                        showState && selected && !isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                        submitted && !showState && 'border-border opacity-60',
                      )}
                    >
                      {opt}
                      {showState && isCorrect && <Check className="h-4 w-4 shrink-0" />}
                      {showState && selected && !isCorrect && <X className="h-4 w-4 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </Card>
          ))}
        </FadeIn>

        {submitted ? (
          <FadeIn>
            <Card className="border-primary/30 bg-primary/5 p-6 text-center">
              <p className="font-heading text-3xl font-extrabold text-foreground">
                {correct}/{questions.length}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                 jawaban benar • +{correct * 20} XP
              </p>
              <Button
                className="mt-4"
                variant="outline"
                 onClick={() => {
                   setSubmitted(false)
                    setAnswers(questions.map(() => null))
                    setResults(questions.map(() => null))
                    setCorrectOptions(questions.map(() => null))
                    setAttemptIds(questions.map(() => crypto.randomUUID()))
                    setSubmitError(null)
                 }}
              >
                Coba lagi
              </Button>
            </Card>
          </FadeIn>
        ) : (
          <Button
            className="w-full"
             disabled={answers.some((a) => a === null) || submitting}
             onClick={async () => {
               setSubmitting(true)
               setSubmitError(null)
               try {
                 const nextResults: (boolean | null)[] = []
                 const nextCorrect: (number | null)[] = []
                 for (let qi = 0; qi < questions.length; qi += 1) {
                   const response = await fetch('/api/student/question-bank', {
                     method: 'POST',
                     headers: { 'content-type': 'application/json' },
                     body: JSON.stringify({ questionId: questions[qi].id, selectedOption: answers[qi], attemptId: attemptIds[qi] }),
                   })
                   if (!response.ok) throw new Error('SUBMIT_FAILED')
                   const payload = await response.json() as { data?: { isCorrect?: boolean; correctOption?: number } }
                   if (!payload.data) throw new Error('SUBMIT_FAILED')
                   nextResults.push(payload.data.isCorrect === true)
                   nextCorrect.push(payload.data.correctOption ?? null)
                 }
                 setResults(nextResults)
                 setCorrectOptions(nextCorrect)
                 setMasteredIds((ids) => questions.reduce((next, question, index) => (
                   nextResults[index] && !next.includes(question.id) ? [...next, question.id] : next
                 ), ids))
                 setSubmitted(true)
               } catch {
                 setSubmitError('Jawaban belum tersimpan sepenuhnya. Coba kumpulkan lagi.')
               } finally {
                 setSubmitting(false)
               }
             }}
           >
             {submitting ? 'Menyimpan...' : 'Kumpulkan Jawaban'}
           </Button>
         )}
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
        </div>}
      <CompletionDialog
        open={submitted}
        title={correct / Math.max(questions.length, 1) >= 0.8 ? 'Listening mantap!' : 'Listening selesai'}
        message="Semua jawaban listening sudah dikonfirmasi tersimpan oleh server."
        score={`${Math.round((correct / Math.max(questions.length, 1)) * 100)}/100`}
        detail={`Jawaban benar: ${correct}/${questions.length} • XP terkonfirmasi: +${correct * 20}`}
        onClose={() => setSubmitted(false)}
      />
     </div>
  )
}
