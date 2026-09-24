'use client'

import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import { Lock } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type Achievement = { id: string; title: string; desc: string; category: string; unlocked: boolean; progress: number; icon: string }
const CATEGORIES = ['Semua', 'Speaking', 'Vocabulary', 'Listening', 'Streak']

export default function AchievementsPage() {
  const [cat, setCat] = useState('Semua')
  const [achievements, setAchievements] = useState<Achievement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/student/learning-stats')
      .then(async (response) => {
        if (!response.ok) throw new Error('Gagal memuat pencapaian.')
        return response.json()
      })
      .then((payload) => setAchievements(payload.data.achievements))
      .catch((cause: Error) => setError(cause.message))
  }, [])

  const unlockedCount = achievements?.filter((achievement) => achievement.unlocked).length ?? 0
  const filtered = achievements?.filter((achievement) => cat === 'Semua' || achievement.category === cat) ?? []

  return (
    <div className="space-y-8">
      <PageHeader title="Pencapaian" description={achievements ? `Kamu telah membuka ${unlockedCount} dari ${achievements.length} lencana.` : 'Pencapaian dihitung dari aktivitas belajar yang tersimpan.'} />
      {error && <Card className="border-destructive/40 p-4 text-sm text-destructive">{error}</Card>}
      {!achievements && !error && <Card className="p-6 text-sm text-muted-foreground">Memuat pencapaian...</Card>}
      {achievements && (
        <>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => <button key={category} onClick={() => setCat(category)} className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-colors', cat === category ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>{category}</button>)}
          </div>
          <FadeInStagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((achievement) => {
              const Icon = (Icons[achievement.icon as keyof typeof Icons] || Icons.Award) as Icons.LucideIcon
              return <FadeInItem key={achievement.id}><Card className={cn('group relative flex h-full flex-col items-center gap-3 p-5 text-center', achievement.unlocked ? 'border-border' : 'border-dashed border-border bg-muted/30')}>
                <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl', achievement.unlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{achievement.unlocked ? <Icon className="h-8 w-8" /> : <Lock className="h-7 w-7" />}</div>
                <div><p className="text-sm font-semibold text-foreground">{achievement.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{achievement.desc}</p></div>
                {achievement.unlocked ? <Badge className="bg-success/15 text-success hover:bg-success/15">Terbuka</Badge> : <div className="w-full"><Progress value={achievement.progress} className="h-1.5" /><p className="mt-1.5 text-xs text-muted-foreground">{Math.round(achievement.progress)}%</p></div>}
              </Card></FadeInItem>
            })}
          </FadeInStagger>
        </>
      )}
    </div>
  )
}
