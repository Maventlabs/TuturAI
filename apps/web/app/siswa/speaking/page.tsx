'use client'

import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import type { QuestionBankItem } from '@tuturai/domain'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { SpeakingSession } from '@/components/student/speaking-session'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<string, string> = {
  Pemula: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Menengah: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Lanjutan: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
}

export default function SpeakingPage() {
  const [topics, setTopics] = useState<QuestionBankItem[]>([])
  const [topic, setTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/student/question-bank?type=speaking&limit=20')
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        setTopics(data)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferred = data.find((item) => item.id === preferredId) ?? data[0]
        setTopic(preferred?.word ?? null)
      })
      .catch(() => setError('Topik speaking belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Speaking Practice"
        description="Pilih topik, jawab pertanyaan dari AI Tutor, dan dapatkan analisis ucapan secara langsung."
      />

      {loading && <Card className="p-6 text-sm text-muted-foreground">Memuat topik speaking...</Card>}
      {error && <Card className="border-destructive/30 p-6 text-sm text-destructive">{error}</Card>}
      {!loading && !error && topics.length === 0 && <Card className="p-6 text-sm text-muted-foreground">Belum ada topik speaking.</Card>}
      {!loading && !error && topic && <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <FadeIn>
          <SpeakingSession questionId={topics.find((item) => item.word === topic)?.id ?? topics[0].id} topic={topic} />
        </FadeIn>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Pilih Topik</h2>
          <FadeInStagger className="grid grid-cols-2 gap-3">
            {topics.map((t) => {
              const Icon = Icons.MessageCircle
              const active = t.word === topic
              const displayLevel = t.level === 'beginner' ? 'Pemula' : t.level === 'intermediate' ? 'Menengah' : 'Lanjutan'
              return (
                <FadeInItem key={t.id}>
                  <button
                     onClick={() => setTopic(t.word ?? null)}
                    className={cn(
                      'flex h-full w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm',
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                     <span className="text-sm font-semibold text-foreground">{t.word}</span>
                    <Badge
                      variant="secondary"
                       className={cn('px-1.5 py-0 text-[10px]', LEVEL_STYLES[displayLevel])}
                    >
                       {t.level === 'beginner' ? 'Pemula' : t.level === 'intermediate' ? 'Menengah' : 'Lanjutan'}
                    </Badge>
                  </button>
                </FadeInItem>
              )
            })}
          </FadeInStagger>

          <Card className="border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icons.Lightbulb className="h-4 w-4 text-amber-500" /> Tips
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Bicara dengan tempo natural dan jangan takut salah. AI Tutor akan memberi
              umpan balik per aspek agar kamu tahu bagian mana yang perlu ditingkatkan.
            </p>
          </Card>
        </div>
      </div>}
    </div>
  )
}
