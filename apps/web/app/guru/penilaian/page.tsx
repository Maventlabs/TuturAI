'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react'
import type { TeacherReviewQueueItem } from '@/lib/submissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { FadeIn } from '@/components/dashboard/fade-in'
import { PageHeader } from '@/components/dashboard/page-header'

function formatSubmittedAt(value: string | null) {
  if (!value) return 'Waktu tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AssessmentPage() {
  const [queue, setQueue] = useState<TeacherReviewQueueItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'approve' | 'return' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/submissions/review-queue', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat antrian review')
        if (!cancelled) {
          setQueue(payload.data)
          setActiveId(payload.data[0]?.submission.id ?? null)
          setFeedback(payload.data[0]?.submission.teacherFeedback ?? '')
        }
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat antrian review') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const active = queue.find((item) => item.submission.id === activeId) ?? null

  function select(item: TeacherReviewQueueItem) {
    setActiveId(item.submission.id)
    setFeedback(item.submission.teacherFeedback ?? '')
    setError(null)
  }

  async function review(nextAction: 'approve' | 'return') {
    if (!active) return
    if (nextAction === 'return' && !feedback.trim()) {
      setError('Feedback wajib diisi sebelum submission dikembalikan')
      return
    }
    setAction(nextAction)
    setError(null)
    try {
      const response = await fetch(`/api/submissions/${active.submission.id}/${nextAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal menyimpan review')
      setQueue((current) => current.filter((item) => item.submission.id !== active.submission.id))
      const next = queue.find((item) => item.submission.id !== active.submission.id)
      setActiveId(next?.submission.id ?? null)
      setFeedback(next?.submission.teacherFeedback ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan review')
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Penilaian Speaking" description="Tinjau submission siswa dan beri keputusan review." />

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Memuat antrian review...</Card>
      ) : queue.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success" />
          <h2 className="font-heading text-lg font-bold">Tidak ada submission menunggu</h2>
          <p className="mt-1 text-sm text-muted-foreground">Submission baru dari kelas aktif akan muncul di sini.</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <FadeIn>
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-heading text-sm font-bold">Antrian Review</h2>
                <Badge variant="secondary">{queue.length} menunggu</Badge>
              </div>
              <div className="divide-y divide-border">
                {queue.map((item) => (
                  <button
                    key={item.submission.id}
                    type="button"
                    onClick={() => select(item)}
                    className={`w-full p-4 text-left transition-colors hover:bg-secondary/50 ${item.submission.id === activeId ? 'bg-secondary/70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.assignment.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">Siswa: {item.submission.studentId}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.className}</p>
                        {item.assessment && <p className="mt-1 text-xs font-semibold text-brand">AI score: {item.assessment.overall}/100</p>}
                      </div>
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </FadeIn>

          {active && (
            <FadeIn>
              <Card className="space-y-5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-xl font-bold">{active.assignment.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{active.className} · Siswa {active.submission.studentId}</p>
                  </div>
                  <Badge className="gap-1 bg-brand/15 text-brand-foreground"><Clock className="h-3 w-3" /> Menunggu review</Badge>
                </div>

                <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4 text-sm sm:grid-cols-3">
                  <div><span className="text-muted-foreground">Attempt</span><p className="font-semibold">{active.submission.attempt} / {active.assignment.maxAttempts}</p></div>
                  <div><span className="text-muted-foreground">Dikirim</span><p className="font-semibold">{formatSubmittedAt(active.submission.submittedAt)}</p></div>
                  <div><span className="text-muted-foreground">Status waktu</span><p className="font-semibold">{active.submission.isLate ? 'Terlambat' : 'Tepat waktu'}</p></div>
                </div>

                {active.assessment ? (
                  (() => {
                    const assessment = active.assessment
                    return <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-heading text-base font-bold">Hasil AI speaking</h3>
                      <span className="font-mono text-lg font-bold text-brand">{assessment.overall}/100</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                      {(['pronunciation', 'fluency', 'intonation', 'grammar', 'vocabulary'] as const).map((dimension) => (
                        <div key={dimension} className="rounded border border-border bg-background px-2 py-1.5">
                          <span className="block capitalize text-muted-foreground">{dimension}</span>
                          <span className="font-semibold">{assessment[dimension]}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{assessment.feedback}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Transcript: {assessment.transcript}</p>
                  </div>
                  })()
                ) : (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">Belum ada hasil AI untuk submission ini. Review tetap dapat dilakukan berdasarkan submission.</p>
                )}

                <div>
                  <h3 className="mb-2 font-heading text-base font-bold">Instruksi</h3>
                  <p className="rounded-lg bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">{active.assignment.instructions}</p>
                </div>

                <div>
                  <label htmlFor="teacher-feedback" className="mb-2 block font-heading text-base font-bold">Umpan Balik Guru</label>
                  <Textarea id="teacher-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Tulis umpan balik untuk siswa..." className="min-h-28 resize-none" />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => void review('return')} disabled={action !== null} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> {action === 'return' ? 'Mengembalikan...' : 'Kembalikan'}
                  </Button>
                  <Button onClick={() => void review('approve')} disabled={action !== null} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {action === 'approve' ? 'Menyetujui...' : 'Setujui'}
                  </Button>
                </div>
              </Card>
            </FadeIn>
          )}
        </div>
      )}
    </div>
  )
}
