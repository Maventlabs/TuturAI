'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check, Play, Route, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AdaptiveActivity, AdaptivePlan } from '@/lib/adaptive'

function practiceHref(activity: AdaptiveActivity) {
  const routes: Record<AdaptiveActivity['contentType'], string> = {
    question: '/siswa/quiz',
    vocabulary: '/siswa/vocabulary',
    listening: '/siswa/listening',
    pronunciation: '/siswa/pronunciation',
    speaking: '/siswa/speaking',
    conversation: '/siswa/percakapan',
    test: '/siswa/tes',
  }
  return `${routes[activity.contentType]}?questionId=${encodeURIComponent(activity.id)}`
}

export default function AdaptivePage() {
  const [plan, setPlan] = useState<AdaptivePlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/student/adaptive', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Gagal memuat jalur belajar.')
        return response.json() as Promise<{ data: AdaptivePlan }>
      })
      .then((payload) => setPlan(payload.data))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Gagal memuat jalur belajar.')
      })

    return () => controller.abort()
  }, [])

  const completed = plan?.activities.filter((activity) => activity.status === 'completed').length ?? 0

  return (
    <div className="space-y-8">
      <PageHeader title="Adaptive Learning Path" description="Jalur belajar dari materi published dan latihan yang tersimpan di akunmu." />

      {error && <Card className="border-destructive/40 p-6 text-sm text-destructive">{error}</Card>}
      {!plan && !error && <Card className="p-6 text-sm text-muted-foreground">Memuat jalur belajar...</Card>}

      {plan && (
        <>
          <FadeIn>
            <Card className="flex flex-col gap-4 border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Route className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Materi selesai</p>
                  <p className="font-heading text-2xl font-extrabold text-foreground">{completed} / {plan.activities.length}</p>
                </div>
              </div>
              <Badge className="w-fit gap-1 bg-accent/15 text-accent hover:bg-accent/15">
                <Sparkles className="h-3 w-3" /> Rekomendasi tersimpan
              </Badge>
            </Card>
          </FadeIn>

          {plan.recommendation && (
            <Card className="border-primary/30 bg-primary/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Rekomendasi berikutnya</p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">{plan.recommendation.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.reason}</p>
              <Button asChild size="sm" className="mt-4 gap-1">
                <Link href={practiceHref(plan.recommendation)}>Mulai latihan <Play className="h-3.5 w-3.5" /></Link>
              </Button>
            </Card>
          )}

          {plan.activities.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">Belum ada materi adaptive yang dipublikasikan.</Card>
          ) : (
            <FadeInStagger className="space-y-3">
              {plan.activities.map((activity) => (
                <FadeInItem key={activity.id}>
                  <Card className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between', activity.status === 'recommended' && 'border-primary/40')}>
                    <div className="flex items-start gap-3">
                      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', activity.status === 'completed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {activity.status === 'completed' ? <Check className="h-4 w-4" /> : <Route className="h-4 w-4" />}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{activity.title}</h3>
                          <Badge variant="secondary" className="text-[10px]">{activity.level}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{activity.attempts} latihan{activity.score === null ? '' : ` · ${activity.score}% benar`}</p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant={activity.status === 'completed' ? 'outline' : 'default'} className="w-fit sm:shrink-0">
                      <Link href={practiceHref(activity)}>{activity.status === 'completed' ? 'Ulangi' : 'Buka materi'}</Link>
                    </Button>
                  </Card>
                </FadeInItem>
              ))}
            </FadeInStagger>
          )}
        </>
      )}
    </div>
  )
}
