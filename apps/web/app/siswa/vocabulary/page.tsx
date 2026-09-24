'use client'

import { useEffect, useState } from 'react'
import { RotateCw, Volume2, BookText, Check } from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'

export default function VocabularyPage() {
  const [words, setWords] = useState<QuestionBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [masteredIds, setMasteredIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const word = words[index]

  useEffect(() => {
    fetch(`/api/student/question-bank?type=vocabulary&limit=50&run=${Date.now()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[]; masteredIds?: string[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        setWords(data)
        setMasteredIds(payload.masteredIds ?? [])
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferredIndex = preferredId ? data.findIndex((item) => item.id === preferredId) : -1
        if (preferredIndex >= 0) setIndex(preferredIndex)
      })
      .catch(() => setError('Bank kosakata belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  function next() {
    setFlipped(false)
    setIndex((i) => (i + 1) % words.length)
  }

  async function markMastered() {
    if (!word || submitting) return
    setSubmitting(true)
    setActionError(null)
    try {
      const response = await fetch('/api/student/question-bank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: word.id, selectedOption: 0, attemptId: crypto.randomUUID() }),
      })
      const payload = await response.json() as { data?: { isCorrect?: boolean } }
      if (!response.ok || payload.data?.isCorrect !== true) {
        throw new Error('MASTERY_NOT_CONFIRMED')
      }
      setMasteredIds((ids) => {
        const nextIds = ids.includes(word.id) ? ids : [...ids, word.id]
        if (nextIds.length === words.length) setShowCompletion(true)
        return nextIds
      })
      next()
    } catch {
      setActionError('Progress belum tersimpan. Coba lagi saat koneksi tersedia.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vocabulary"
        description="Perkaya kosakatamu dengan kartu interaktif dan pantau tingkat penguasaan."
      />

      {loading && <Card className="p-6 text-sm text-muted-foreground">Memuat bank kosakata...</Card>}
      {error && <Card className="border-destructive/30 p-6 text-sm text-destructive">{error}</Card>}
      {!loading && !error && words.length === 0 && <Card className="p-6 text-sm text-muted-foreground">Belum ada kartu kosakata.</Card>}
      {!loading && !error && word && <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <FadeIn>
          <div className="flex flex-col items-center">
            <button
              onClick={() => setFlipped((f) => !f)}
              className="group relative h-72 w-full max-w-md [perspective:1200px]"
              aria-label="Balik kartu"
            >
              <div
                className={cn(
                  'relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]',
                  flipped && '[transform:rotateY(180deg)]',
                )}
              >
                {/* Front */}
                <Card className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-border [backface-visibility:hidden]">
                  <Badge variant="secondary" className="gap-1">
                    <BookText className="h-3 w-3" /> Kata {index + 1}/{words.length}
                  </Badge>
                  <h2 className="font-heading text-4xl font-extrabold text-foreground">
                    {word.word}
                  </h2>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Volume2 className="h-4 w-4" /> klik untuk melihat arti
                  </span>
                </Card>
                {/* Back */}
                <Card className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-primary/40 bg-primary/5 p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-sm font-medium uppercase tracking-wide text-primary">Arti</p>
                  <h3 className="font-heading text-3xl font-bold text-foreground">{word.meaning}</h3>
                  <p className="text-pretty text-sm italic leading-relaxed text-muted-foreground">
                    &ldquo;{word.example}&rdquo;
                  </p>
                </Card>
              </div>
            </button>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setFlipped((f) => !f)} className="gap-2" disabled={submitting}>
                <RotateCw className="h-4 w-4" /> Balik
              </Button>
              <Button onClick={markMastered} className="gap-2" disabled={submitting}>
                <Check className="h-4 w-4" /> Sudah hafal
              </Button>
            </div>
            {actionError && <p role="alert" className="mt-3 text-sm text-destructive">{actionError}</p>}
          </div>
        </FadeIn>

        <div className="space-y-4">
          <Card className="border-border p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dikuasai</span>
              <span className="font-heading text-2xl font-extrabold text-foreground">
                {masteredIds.length}/{words.length}
              </span>
            </div>
            <Progress value={(masteredIds.length / words.length) * 100} className="mt-3" />
          </Card>

          <h2 className="text-sm font-semibold text-foreground">Daftar Kata</h2>
          <FadeInStagger className="space-y-2">
            {words.map((w, i) => (
              <FadeInItem key={w.word}>
                <button
                  onClick={() => {
                    setIndex(i)
                    setFlipped(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50',
                    i === index ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{w.word}</p>
                    <p className="truncate text-xs text-muted-foreground">{w.meaning}</p>
                  </div>
                  <div className="w-16 shrink-0">
                     <Progress value={masteredIds.includes(w.id) ? 100 : 0} className="h-1.5" />
                    <p className="mt-1 text-right text-[10px] text-muted-foreground">{masteredIds.includes(w.id) ? 'Selesai' : 'Belum'}</p>
                  </div>
                </button>
              </FadeInItem>
            ))}
          </FadeInStagger>
        </div>
      </div>}
      <CompletionDialog
        open={showCompletion}
        title="Kosakata selesai!"
        message="Semua kartu kosakata pada sesi ini sudah dikonfirmasi tersimpan."
        score={`${words.length}/${words.length}`}
        detail="Skor mastery: 100/100"
        onClose={() => setShowCompletion(false)}
      />
    </div>
  )
}
