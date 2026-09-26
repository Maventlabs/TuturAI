'use client'

import { useEffect, useState } from 'react'
import { Crown, Flame, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type LeaderboardRow = {
  rank: number
  studentId: string
  name: string
  xp: number
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [currentStudentId, setCurrentStudentId] = useState<string>()
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    const classroomId = window.localStorage.getItem('tuturai.activeClassroomId')
    const query = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : ''
    fetch(`/api/student/dashboard${query}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('LEADERBOARD_LOAD_FAILED')
        return response.json() as Promise<{ data?: { profile?: { id: string }; leaderboard?: LeaderboardRow[] } }>
      })
      .then((payload) => {
        if (!active) return
        setCurrentStudentId(payload.data?.profile?.id)
        setRows(payload.data?.leaderboard ?? [])
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => { active = false }
  }, [])

  const top3 = rows.slice(0, 3)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean)

  return (
    <div className="space-y-8">
      <PageHeader title="Leaderboard" description="Peringkat XP teman sekelas berdasarkan data aktivitas yang tersimpan." />
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Leaderboard belum dapat dimuat dari server.</p>}
      {rows.length === 0 && !error ? (
        <Card className="p-6 text-sm text-muted-foreground">Belum ada data leaderboard untuk classroom kamu.</Card>
      ) : (
        <>
          <FadeIn>
            <Card className="border-border bg-gradient-to-b from-primary/5 to-transparent p-6">
              <div className="flex items-end justify-center gap-3 sm:gap-6">
                {podiumOrder.map((row) => (
                  <div key={row.studentId} className="flex flex-1 flex-col items-center sm:max-w-[160px]">
                    {row.rank === 1 && <Crown className="mb-1 h-6 w-6 text-amber-400" />}
                    <Avatar className={cn('mb-2 h-14 w-14 ring-2 sm:h-16 sm:w-16', row.rank === 1 ? 'ring-amber-400' : row.rank === 2 ? 'ring-slate-300' : 'ring-orange-400')}>
                      <AvatarFallback className="text-base font-bold">{initials(row.name)}</AvatarFallback>
                    </Avatar>
                    <p className="text-center text-xs font-semibold text-foreground sm:text-sm">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.xp.toLocaleString('id-ID')} XP</p>
                    <div className={cn('mt-3 flex h-20 w-full items-start justify-center rounded-t-lg pt-2 font-heading text-2xl font-extrabold', row.rank === 1 ? 'h-28 bg-amber-400/15 text-amber-500' : row.rank === 2 ? 'bg-slate-300/15 text-slate-400' : 'h-16 bg-orange-400/15 text-orange-500')}>{row.rank}</div>
                  </div>
                ))}
              </div>
            </Card>
          </FadeIn>
          <FadeIn>
            <Card className="divide-y divide-border border-border">
              {rows.map((row) => {
                const isMe = row.studentId === currentStudentId
                return (
                  <div key={row.studentId} className={cn('flex items-center gap-4 px-4 py-3 sm:px-6', isMe && 'bg-primary/5')}>
                    <span className="w-6 text-center font-mono text-sm font-bold text-muted-foreground">{row.rank}</span>
                    <Avatar className="h-10 w-10"><AvatarFallback className="text-sm font-semibold">{initials(row.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{row.name}{isMe && <span className="ml-2 text-xs font-normal text-primary">(Kamu)</span>}</p></div>
                    <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Flame className="h-3.5 w-3.5 text-brand" /> durable</div>
                    <span className="font-mono text-sm font-bold tabular-nums text-foreground">{row.xp.toLocaleString('id-ID')} XP</span>
                  </div>
                )
              })}
            </Card>
          </FadeIn>
        </>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Data berasal dari XP user yang tersimpan di Firestore.</p>
    </div>
  )
}
