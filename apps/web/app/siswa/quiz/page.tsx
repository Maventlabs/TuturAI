'use client'

import { useEffect, useState } from 'react'
import type { QuestionBankItem } from '@tuturai/domain'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Trophy, ListChecks, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/dashboard/progress-ring'
import { cn } from '@/lib/utils'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'
import { getQuizCompletionSummary } from '@/lib/completion'

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [locked, setLocked] = useState(false)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [correctOption, setCorrectOption] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/student/question-bank?skill=grammar&level=beginner&limit=10')
      .then(async (response) => {
        if (!response.ok) throw new Error('QUESTION_BANK_LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        if (!active) return
        const data = payload.data ?? []
        setQuestions(data)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferredIndex = preferredId ? data.findIndex((item) => item.id === preferredId) : -1
        if (preferredIndex >= 0) setCurrent(preferredIndex)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError('Bank soal belum dapat dimuat. Coba lagi beberapa saat lagi.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const item = questions[current]

  async function pick(oi: number) {
    if (locked || !item) return
    setSelected(oi)
    setLocked(true)
    setAnswerError(null)
    setCorrectOption(null)
    try {
      const response = await fetch('/api/student/question-bank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: item.id, selectedOption: oi, attemptId: crypto.randomUUID() }),
      })
      if (!response.ok) throw new Error('ANSWER_FAILED')
      const payload = await response.json() as { data?: { isCorrect?: boolean; correctOption?: number } }
      setCorrectOption(payload.data?.correctOption ?? null)
      if (payload.data?.isCorrect) setScore((s) => s + 1)
    } catch {
      setAnswerError('Jawaban belum tersimpan. Periksa koneksi lalu coba soal ini lagi.')
      setSelected(null)
      setLocked(false)
      setCorrectOption(null)
    }
  }

  function next() {
    if (current + 1 >= questions.length) {
      setDone(true)
      return
    }
    setCurrent((c) => c + 1)
    setSelected(null)
    setLocked(false)
    setCorrectOption(null)
  }

  function restart() {
    setCurrent(0)
    setSelected(null)
    setScore(0)
    setDone(false)
    setLocked(false)
    setCorrectOption(null)
  }

  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
  const completion = getQuizCompletionSummary(score, questions.length)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quiz Harian"
        description="Uji pemahaman grammar dan vocabulary-mu. Selesaikan untuk meraih XP bonus."
      />

      <div className="mx-auto max-w-2xl">
        {loading ? (
          <Card className="border-border p-6 text-sm text-muted-foreground">Bank soal sedang dimuat...</Card>
        ) : error ? (
          <Card className="border-destructive/40 p-6 text-sm text-destructive">{error}</Card>
        ) : questions.length === 0 ? (
          <Card className="border-border p-6 text-sm text-muted-foreground">Belum ada soal grammar yang tersedia.</Card>
        ) : !done ? (
          <FadeIn>
            <Card className="border-border p-6">
              <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="gap-1">
                   <ListChecks className="h-3 w-3" /> Soal {current + 1}/{questions.length}
                </Badge>
                <span className="text-sm font-medium text-muted-foreground">Skor: {score}</span>
              </div>
               <Progress value={((current + (locked ? 1 : 0)) / questions.length) * 100} className="mt-3" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="mt-6 text-pretty text-lg font-semibold leading-relaxed text-foreground">
                    {item.prompt}
                  </h2>
                  <div className="mt-5 space-y-3">
                    {item.options.map((opt, oi) => {
                       const isAnswer = locked && answerError === null && oi === correctOption
                       const isSelected = oi === selected
                       return (
                        <button
                          key={oi}
                          onClick={() => pick(oi)}
                          disabled={locked}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                            !locked && 'border-border hover:border-primary/50 hover:bg-muted/50',
                             locked && isAnswer && 'border-success bg-success/10 text-success',
                             locked && isSelected && !isAnswer && 'border-destructive bg-destructive/10 text-destructive',
                             locked && !isAnswer && !isSelected && 'border-border opacity-60',
                          )}
                        >
                          {opt}
                           {locked && isAnswer && <Check className="h-4 w-4" />}
                           {locked && isSelected && !isAnswer && <X className="h-4 w-4" />}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

               {answerError && <p className="mt-4 text-sm text-destructive">{answerError}</p>}

               {locked && !answerError && (
                <Button className="mt-6 w-full gap-2" onClick={next}>
                   {current + 1 >= questions.length ? 'Lihat Hasil' : 'Soal Berikutnya'}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            <Card className="flex flex-col items-center gap-4 border-border p-8 text-center">
              <ProgressRing value={pct} size={140} label={`${score}/${questions.length}`} sublabel="benar" />
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-bold text-foreground">
                  {pct >= 80 ? 'Luar biasa!' : pct >= 50 ? 'Bagus!' : 'Terus berlatih!'}
                </h2>
              </div>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                 Kamu menjawab {score} dari {questions.length} soal dengan benar dan mendapatkan{' '}
                <span className="font-semibold text-foreground">+{score * 20} XP</span>.
              </p>
              <Button onClick={restart} className="mt-2">
                Ulangi Quiz
              </Button>
            </Card>
          </FadeIn>
        )}
      </div>
      <CompletionDialog
        open={done}
        title={completion.title}
        message={completion.message}
        score={`${pct}/100`}
        detail={`XP terkonfirmasi dari jawaban benar: +${score * 20}`}
        onClose={() => setDone(false)}
      />
    </div>
  )
}
