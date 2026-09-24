'use client'

import { useEffect, useState } from 'react'
import { Check, X, ChevronRight, ListChecks } from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/dashboard/progress-ring'
import { cn } from '@/lib/utils'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'
import { getQuizCompletionSummary } from '@/lib/completion'

export default function TesPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [locked, setLocked] = useState(false)
  const [done, setDone] = useState(false)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [correctOption, setCorrectOption] = useState<number | null>(null)
  const item = questions[current]

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/student/question-bank?type=test&limit=20', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('QUESTION_BANK_LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        setQuestions(data)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferredIndex = preferredId ? data.findIndex((question) => question.id === preferredId) : -1
        if (preferredIndex >= 0) setCurrent(preferredIndex)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError('Bank soal tes belum dapat dimuat. Coba lagi nanti.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  async function answer(option: number) {
    if (!item || locked) return
    setSelected(option)
    setLocked(true)
    setAnswerError(null)
    setCorrectOption(null)
    try {
      const response = await fetch('/api/student/question-bank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: item.id, selectedOption: option, attemptId: crypto.randomUUID() }),
      })
      if (!response.ok) throw new Error('ANSWER_FAILED')
      const payload = await response.json() as { data?: { isCorrect?: boolean; correctOption?: number } }
      setCorrectOption(payload.data?.correctOption ?? null)
      if (payload.data?.isCorrect) setCorrect((value) => value + 1)
    } catch {
      setAnswerError('Jawaban belum tersimpan. Periksa koneksi lalu coba lagi.')
      setSelected(null)
      setLocked(false)
    }
  }

  function next() {
    if (current + 1 >= questions.length) setDone(true)
    else {
      setCurrent((value) => value + 1)
      setSelected(null)
      setLocked(false)
      setCorrectOption(null)
    }
  }

  function restart() {
    setCurrent(0)
    setSelected(null)
    setCorrect(0)
    setLocked(false)
    setDone(false)
    setCorrectOption(null)
    setAnswerError(null)
  }

  const percentage = questions.length ? Math.round((correct / questions.length) * 100) : 0
  const completion = getQuizCompletionSummary(correct, questions.length)

  return (
    <div className="space-y-8">
      <PageHeader title="Tes Pedagogis" description="Selesaikan soal tes yang dipublikasikan untuk mengukur pemahamanmu." />
      <div className="mx-auto max-w-2xl">
        {loading ? <Card className="p-6 text-sm text-muted-foreground">Bank soal tes sedang dimuat...</Card> : error ? <Card className="border-destructive/40 p-6 text-sm text-destructive">{error}</Card> : questions.length === 0 ? <Card className="p-6 text-sm text-muted-foreground">Belum ada soal tes yang dipublikasikan.</Card> : done ? (
          <FadeIn><Card className="flex flex-col items-center gap-4 border-border p-8 text-center"><ProgressRing value={percentage} size={140} label={`${correct}/${questions.length}`} sublabel="benar" /><h2 className="text-xl font-bold text-foreground">Hasil tes</h2><p className="text-pretty text-sm leading-relaxed text-muted-foreground">Kamu menjawab {correct} dari {questions.length} soal dengan benar.</p><Button onClick={restart}>Ulangi Tes</Button></Card></FadeIn>
        ) : (
          <FadeIn><Card className="border-border p-6"><div className="flex items-center justify-between"><Badge variant="secondary" className="gap-1"><ListChecks className="h-3 w-3" /> Soal {current + 1}/{questions.length}</Badge><span className="text-sm font-medium text-muted-foreground">Skor: {correct}</span></div><Progress value={((current + (locked ? 1 : 0)) / questions.length) * 100} className="mt-3" /><h2 className="mt-6 text-pretty text-lg font-semibold leading-relaxed text-foreground">{item.prompt}</h2><div className="mt-5 space-y-3">{item.options.map((option, index) => { const isCorrect = locked && index === correctOption; const isSelected = index === selected; return <button key={option} onClick={() => answer(index)} disabled={locked} className={cn('flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors', !locked && 'border-border hover:border-primary/50 hover:bg-muted/50', locked && isCorrect && 'border-success bg-success/10 text-success', locked && isSelected && !isCorrect && 'border-destructive bg-destructive/10 text-destructive', locked && !isCorrect && !isSelected && 'border-border opacity-60')}>{option}{locked && isCorrect && <Check className="h-4 w-4" />}{locked && isSelected && !isCorrect && <X className="h-4 w-4" />}</button> })}</div>{answerError && <p className="mt-4 text-sm text-destructive">{answerError}</p>}{locked && !answerError && <Button className="mt-6 w-full gap-2" onClick={next}>{current + 1 >= questions.length ? 'Lihat Hasil' : 'Soal Berikutnya'}<ChevronRight className="h-4 w-4" /></Button>}</Card></FadeIn>
        )}
      </div>
      <CompletionDialog
        open={done}
        title={completion.title}
        message="Semua jawaban tes sudah dikonfirmasi tersimpan oleh server."
        score={`${percentage}/100`}
        detail={`Jawaban benar: ${correct}/${questions.length}`}
        onClose={() => setDone(false)}
      />
    </div>
  )
}
