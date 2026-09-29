'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, Target, Flame } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ChartCard } from '@/components/dashboard/chart-card'
import { Card } from '@/components/ui/card'

// recharts (~336 KB) is only needed once trend data exists; keep it out of the
// page bundle and show a real loading state while its chunk downloads (PERF-001).
const ScoreTrendChart = dynamic(
  () => import('@/components/dashboard/score-trend-chart').then((module) => module.ScoreTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] w-full items-center justify-center text-xs text-muted-foreground">
        Memuat grafik tren…
      </div>
    ),
  },
)

type Stats = {
  profile: { level: number; streak: number }
  summary: { totalAttempts: number; score: number | null }
  trend: { week: string; skor: number }[]
  skills: { skill: string; score: number; attempts: number }[]
}

export default function ProgressPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/student/learning-stats')
      .then(async (response) => {
        if (!response.ok) throw new Error('Gagal memuat progress belajar.')
        return response.json()
      })
      .then((payload) => setStats(payload.data))
      .catch((cause: Error) => setError(cause.message))
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader title="Progress Belajar" description="Pantau perkembangan kemampuan bahasa Inggrismu dari data latihan yang tersimpan." />
      {error && <Card className="border-destructive/40 p-4 text-sm text-destructive">{error}</Card>}
      {!stats && !error && <Card className="p-6 text-sm text-muted-foreground">Memuat progress belajar...</Card>}
      {stats && (
        <>
          <FadeInStagger className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <FadeInItem><KpiCard label="Skor Latihan" value={stats.summary.score === null ? 'Belum ada data' : stats.summary.score} suffix={stats.summary.score === null ? undefined : ''} icon={Target} tone="primary" /></FadeInItem>
            <FadeInItem><KpiCard label="Total Latihan" value={stats.summary.totalAttempts} icon={TrendingUp} tone="accent" /></FadeInItem>
            <FadeInItem><KpiCard label="Streak" value={stats.profile.streak} suffix=" hari" icon={Flame} tone="brand" /></FadeInItem>
          </FadeInStagger>

          {stats.summary.totalAttempts === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">Belum ada latihan tersimpan. Mulai dari Vocabulary, Listening, atau Tes Pedagogis.</Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Tren Skor Latihan" description="Berdasarkan attempt yang tersimpan">
                <ScoreTrendChart trend={stats.trend} />
              </ChartCard>
              <ChartCard title="Kemampuan" description="Akurasi per skill dari jawaban tersimpan">
                <div className="space-y-4">
                  {stats.skills.map((skill) => (
                    <div key={skill.skill}>
                      <div className="flex justify-between text-sm"><span className="capitalize text-foreground">{skill.skill}</span><span className="text-muted-foreground">{skill.score}% · {skill.attempts} latihan</span></div>
                      <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${skill.score}%` }} /></div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  )
}
