'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Lock, FileText } from 'lucide-react'
import { adaptiveCategories, adaptiveLevels, getAdaptiveLevelForScore } from '@/lib/adaptive-modules'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState, MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import type { AdaptiveActivity, AdaptivePlan } from '@/lib/adaptive'

const MIN_SESSIONS = 3

const ASPECTS = [
  { key: 'speaking', label: 'Speaking', skills: ['speaking'] },
  { key: 'reading', label: 'Reading', skills: ['reading'] },
  { key: 'listening', label: 'Listening', skills: ['listening'] },
  { key: 'quiz', label: 'Kuis', skills: ['grammar', 'vocabulary'] },
] as const

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

function abilityLabel(average: number | null) {
  const id = getAdaptiveLevelForScore(average)
  return id ? adaptiveLevels.find((level) => level.id === id)?.label ?? null : null
}

function levelLabel(level: AdaptiveActivity['level']) {
  return level === 'beginner' ? 'Pemula' : level === 'intermediate' ? 'Menengah' : 'Lanjutan'
}

type Aspect = {
  key: string
  label: string
  sessions: number
  average: number | null
  level: string | null
  reason: string
}

export function AdaptiveMap() {
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

  const aspects: Aspect[] = useMemo(() => {
    if (!plan) return []
    return ASPECTS.map((aspect) => {
      const relevant = plan.activities.filter((activity) =>
        (aspect.skills as readonly string[]).includes(activity.skill),
      )
      const sessions = relevant.reduce((total, activity) => total + activity.attempts, 0)
      const scored = relevant.filter((activity) => activity.score !== null && activity.attempts > 0)
      const weighted = scored.reduce((total, activity) => total + (activity.score as number) * activity.attempts, 0)
      const weight = scored.reduce((total, activity) => total + activity.attempts, 0)
      const average = weight > 0 ? Math.round(weighted / weight) : null
      return {
        key: aspect.key,
        label: aspect.label,
        sessions,
        average,
        level: sessions >= MIN_SESSIONS ? abilityLabel(average) : null,
        reason:
          sessions < MIN_SESSIONS
            ? `Belum cukup data, minimal ${MIN_SESSIONS} sesi. Saat ini ${sessions} sesi tercatat.`
            : `Rata-rata ${average ?? 0} dari ${sessions} latihan pada ${relevant.length} materi.`,
      }
    })
  }, [plan])

  if (error) return <EmptyState title="Jalur belajar tidak tersedia" description={error} />

  if (!plan) {
    return (
      <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Memuat jalur belajar
      </div>
    )
  }

  const completed = plan.activities.filter((activity) => activity.status === 'completed').length
  const diagnosis = (
    <div className="flex flex-col">
      <PanelHeader label="Diagnosa" right={<MonoLabel>{completed}/{plan.activities.length} selesai</MonoLabel>} />
      <ul className="divide-y divide-rule">
        {aspects.map((aspect) => {
          const insufficient = aspect.sessions < MIN_SESSIONS || aspect.average === null
          return (
            <li key={aspect.key} className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <MonoLabel className="text-foreground">{aspect.label}</MonoLabel>
                <span
                  className={cn(
                    'font-mono text-[10px] uppercase tracking-[0.12em]',
                    insufficient ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {insufficient ? 'Belum dinilai' : aspect.level}
                </span>
              </div>
              <div className="relative mt-2 h-[5px] w-full overflow-hidden rounded-[1px] bg-secondary">
                {insufficient ? (
                  <span className="absolute inset-0 border border-dashed border-border" />
                ) : (
                  <span
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{ width: `${Math.max(2, Math.min(100, aspect.average as number))}%` }}
                  />
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{aspect.reason}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="lg:hidden">
          <details className="border border-rule bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <MonoLabel>Diagnosa empat aspek</MonoLabel>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {completed}/{plan.activities.length}
              </span>
            </summary>
            <div className="border-t border-rule">{diagnosis}</div>
          </details>
        </div>
        <Panel className="hidden overflow-hidden lg:block">{diagnosis}</Panel>
      </div>

      <div className="min-w-0">
        <section className="mb-5 border border-rule bg-card" aria-labelledby="adaptive-modules-title">
          <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <MonoLabel>Modul belajar</MonoLabel>
              <h2 id="adaptive-modules-title" className="mt-1 font-heading text-sm font-bold text-foreground">16 modul sesuai kemampuan</h2>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">4 kategori × 4 level</span>
          </div>
          <div className="divide-y divide-rule">
            {adaptiveCategories.map((category) => {
              const aspect = aspects.find((item) => item.key === category.id)
              const recommendedLevel = aspect && aspect.sessions >= MIN_SESSIONS
                ? getAdaptiveLevelForScore(aspect.average)
                : null
              return (
                <div key={category.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-32">
                    <p className="text-xs font-semibold text-foreground">{category.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {recommendedLevel
                        ? `Rekomendasi: ${adaptiveLevels.find((level) => level.id === recommendedLevel)?.label}`
                        : 'Kumpulkan minimal 3 sesi untuk rekomendasi'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {adaptiveLevels.map((level) => {
                      const selected = level.id === recommendedLevel
                      return (
                        <Button key={level.id} asChild size="sm" variant={selected ? 'default' : 'outline'} className="h-8 px-2.5 text-[10px]">
                          <Link href={`/siswa/adaptive/modul/${category.id}-${level.id}`} aria-label={`Buka modul ${category.label}, ${level.label}${selected ? ', rekomendasi berdasar hasil latihan' : ''}`}>
                            <FileText aria-hidden="true" /> {level.label}
                          </Link>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {plan.recommendation ? (
          <div className="border-y border-r border-rule border-l-2 border-l-primary bg-card px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <MonoLabel className="text-primary-deep">Rekomendasi berikutnya</MonoLabel>
              <MonoLabel>{levelLabel(plan.recommendation.level)}</MonoLabel>
            </div>
            <h2 className="mt-2 font-heading text-[17px] font-bold leading-tight tracking-[-0.01em] text-foreground">
              {plan.recommendation.title}
            </h2>
            <p className="mt-1.5 max-w-[62ch] text-pretty text-[12px] leading-relaxed text-muted-foreground">
              {plan.reason}
            </p>
            <Button asChild size="sm" className="mt-3 gap-1.5">
              <Link href={practiceHref(plan.recommendation)}>
                Mulai latihan <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-5 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
          <MonoLabel>Jalur modul</MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {plan.activities.length} materi
          </span>
        </div>

        {plan.activities.length === 0 ? (
          <EmptyState
            title="Belum ada materi"
            description="Belum ada materi adaptive yang dipublikasikan. Jalur akan terbentuk setelah guru menambahkan materi."
          />
        ) : (
          <ol className="mt-4">
            {plan.activities.map((activity, index) => {
              const isCompleted = activity.status === 'completed'
              const isRecommended = activity.status === 'recommended'
              const isLocked = !isCompleted && !isRecommended && index > 0 && plan.activities[index - 1].status !== 'completed'
              const connector = isCompleted
                ? 'bg-primary'
                : isRecommended
                  ? 'border-l border-dashed border-primary'
                  : 'bg-rule'
              return (
                <li key={activity.id} className="relative pl-7 pb-3 last:pb-0">
                  {index < plan.activities.length - 1 ? (
                    <span aria-hidden="true" className={cn('absolute left-[5px] top-6 h-full w-px', connector)} />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-0 top-[18px] size-[11px] rounded-full border-2',
                      isCompleted && 'border-primary bg-primary',
                      isRecommended && 'border-primary bg-card',
                      !isCompleted && !isRecommended && 'border-border bg-card',
                    )}
                  />
                  <Panel
                    className={cn(
                      'px-4 py-3',
                      isRecommended && 'border-primary/50',
                      isLocked && 'bg-secondary/40',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={cn(
                              'font-heading text-[14px] font-bold leading-tight tracking-[-0.01em]',
                              isLocked ? 'text-muted-foreground' : 'text-foreground',
                            )}
                          >
                            {activity.title}
                          </h3>
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                            {levelLabel(activity.level)}
                          </span>
                        </div>
                        <p className="mt-1 max-w-[58ch] text-pretty text-[12px] leading-relaxed text-muted-foreground">
                          {activity.description}
                        </p>
                        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          {activity.attempts} latihan
                          {activity.score === null ? '' : ` · ${activity.score}% benar`}
                          {isCompleted ? ' · sudah dibaca' : isLocked ? ' · terkunci' : ' · belum dibuka'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isCompleted ? (
                          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-primary-deep">
                            <Check className="size-3" aria-hidden="true" /> Selesai
                          </span>
                        ) : null}
                        {isLocked ? (
                          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                            <Lock className="size-3" aria-hidden="true" /> Selesaikan materi sebelumnya
                          </span>
                        ) : (
                          <Button asChild size="sm" variant={isCompleted ? 'outline' : 'default'}>
                            <Link href={practiceHref(activity)}>{isCompleted ? 'Ulangi' : 'Buka materi'}</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Panel>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
