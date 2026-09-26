'use client'

import { useEffect, useState } from 'react'
import { Trophy, Medal, Crown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
import { cn } from '@/lib/utils'

type ClassroomFilter = { id: string; name: string }

const PODIUM_STYLES = [
  { ring: 'ring-[var(--chart-4)]', bg: 'bg-[var(--chart-4)]/10', order: 'order-2', scale: 'lg:scale-110', icon: Crown },
  { ring: 'ring-muted-foreground/30', bg: 'bg-muted', order: 'order-1', scale: '', icon: Medal },
  { ring: 'ring-[var(--chart-5)]', bg: 'bg-[var(--chart-5)]/10', order: 'order-3', scale: '', icon: Medal },
]

type LeaderboardRow = {
  studentId: string
  name: string
  classId: string
  className: string
  xp: number
  speakingScore: number | null
  rank: number
}

type ApiResponse = { data: LeaderboardRow[]; error?: { message?: string } }

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'S'
}

function unavailableMetric() {
  return <span className="text-xs font-normal text-muted-foreground">Belum tersedia</span>
}

export default function TeacherLeaderboardPage() {
  const [classrooms, setClassrooms] = useState<ClassroomFilter[]>([])
  const [members, setMembers] = useState<LeaderboardRow[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadLeaderboard() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/teacher/leaderboard', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json() as ApiResponse
        if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat leaderboard')
        setClassrooms([...new Map(payload.data.map((row) => [row.classId, { id: row.classId, name: row.className }])).values()])
        setMembers(payload.data)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat leaderboard')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadLeaderboard()
    return () => controller.abort()
  }, [])

  const filtered = filter === 'all' ? members : members.filter((member) => member.className === filter)

  const podium = filtered.slice(0, 3)
  const rest = filtered.slice(3)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Papan Peringkat"
        description="Peringkat siswa berdasarkan XP durable dari classroom yang Anda kelola."
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Semua Kelas
        </Button>
        {classrooms.map((classroom) => (
          <Button
            key={classroom.id}
            variant={filter === classroom.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(classroom.name)}
          >
            {classroom.name}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status" aria-busy="true">
          Memuat data anggota classroom...
        </Card>
      ) : classrooms.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground" role="status">
          Belum ada classroom yang Anda miliki.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Belum ada siswa di kelas ini.
          </p>
        </Card>
      ) : (
        <>
          <FadeIn>
            <div className="flex items-end justify-center gap-3 sm:gap-6">
              {podium.map((row, i) => {
                const style = PODIUM_STYLES[i]
                const Icon = style.icon
                return (
                  <div key={`${row.classId}-${row.studentId}`} className={cn('flex flex-1 flex-col items-center', style.order, style.scale)}>
                    <div className="relative">
                      <Avatar className={cn('h-16 w-16 ring-4 sm:h-20 sm:w-20', style.ring)}>
                        <AvatarFallback className="text-lg font-bold">{initials(row.name)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-3 text-center text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.className}</p>
                      <Card className={cn('mt-3 flex w-full flex-col items-center rounded-xl border-0 p-4', style.bg)}>
                        {row.speakingScore === null ? unavailableMetric() : <span className="text-lg font-bold text-foreground">{row.speakingScore}%</span>}
                        <span className="text-xs text-muted-foreground">Skor Speaking</span>
                    </Card>
                  </div>
                )
              })}
            </div>
          </FadeIn>

          <FadeInStagger className="space-y-2">
            {rest.map((row) => (
              <FadeInItem key={`${row.classId}-${row.studentId}`}>
                <Card className="flex items-center gap-4 p-3 transition-colors hover:bg-muted/40 sm:p-4">
                  <span className="w-8 text-center font-heading text-lg font-bold text-muted-foreground">{row.rank}</span>
                  <Avatar className="h-11 w-11"><AvatarFallback className="font-semibold">{initials(row.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.className}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                      <p className="text-sm font-semibold text-foreground">{row.xp} XP</p>
                      <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                  <div className="flex w-24 flex-col items-end">
                    {row.speakingScore === null ? unavailableMetric() : <span className="text-sm font-semibold text-foreground">{row.speakingScore}%</span>}
                    <span className="text-xs text-muted-foreground">Speaking</span>
                  </div>
                </Card>
              </FadeInItem>
            ))}
          </FadeInStagger>
        </>
      )}
    </div>
  )
}
