'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Classroom } from '@tuturai/domain'
import {
  Flame,
  Star,
  Trophy,
  Zap,
  Mic,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Stagger, StaggerItem } from '@/components/dashboard/fade-in'
import { AnimatedNumber } from '@/components/dashboard/animated-number'
import { cn } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 19) return 'Selamat sore'
  return 'Selamat malam'
}

type StudentProfile = {
  id: string
  full_name: string | null
  level: number
  xp: number
  rank: number | null
  streak: number | null
}

type DashboardAssignment = {
  id: string
  title: string
  dueAt: string | null
  classroomName: string
  submission: { status: string } | null
}

type LeaderboardRow = {
  rank: number
  studentId: string
  name: string
  xp: number
}

type DashboardInsights = {
  totalAttempts: number
  weeklyTarget: { completed: number; target: number }
  recentActivity: Array<{ id: string; questionId?: string; isCorrect?: boolean; createdAt?: string }>
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [assignments, setAssignments] = useState<DashboardAssignment[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [insights, setInsights] = useState<DashboardInsights | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      try {
        const response = await fetch('/api/student/dashboard', { cache: 'no-store' })
        if (!response.ok) throw new Error('PROFILE_LOAD_FAILED')
         const payload = (await response.json()) as { data?: { profile?: StudentProfile; assignments?: DashboardAssignment[]; leaderboard?: LeaderboardRow[]; insights?: DashboardInsights } }
        if (!payload.data?.profile || payload.data.profile.level < 1 || payload.data.profile.xp < 0) {
          throw new Error('PROFILE_INVALID')
        }
        if (active) {
          setProfile(payload.data.profile)
          setAssignments(payload.data.assignments ?? [])
           setLeaderboard(payload.data.leaderboard ?? [])
           setInsights(payload.data.insights ?? null)
        }
      } catch {
        if (active) setProfileError(true)
      }
    }

    void loadProfile()
    return () => {
      active = false
    }
  }, [])

  const stats = [
    { label: 'Level', value: profile?.level ?? null, icon: Star, tone: 'brand' },
    { label: 'Total XP', value: profile?.xp ?? null, icon: Zap, tone: 'accent' },
     { label: 'Peringkat Kelas', value: profile?.rank ?? null, prefix: '#', icon: Trophy, tone: 'primary' },
     { label: 'Streak (hari)', value: profile?.streak ?? null, icon: Flame, tone: 'destructive' },
  ] as const

  return (
    <div className="mx-auto max-w-6xl">
      {/* Welcome */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-foreground/80">
            {greeting()}, {profile?.full_name?.split(' ')[0] ?? 'Siswa'}!
          </p>
          <h1 className="mt-1 text-balance font-heading text-2xl font-extrabold tracking-tight">
            Ayo lanjutkan latihan speaking-mu hari ini
          </h1>
          <div className="mt-3 text-xs font-semibold">
            {profile ? `Level ${profile.level} • ${profile.xp.toLocaleString('id-ID')} XP` : 'Memuat profil...'}
          </div>
          {profileError && <p role="alert" className="mt-2 text-xs font-semibold">Profil belum dapat dimuat dari server.</p>}
        </div>
        <Button asChild variant="secondary" className="gap-2 shadow-sm">
          <Link href="/siswa/speaking">
            <Mic className="h-4 w-4" />
            Mulai Latihan
          </Link>
        </Button>
      </div>

      <ClassroomMembershipPanel />

      {/* Stat cards */}
      <Stagger className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <StaggerItem key={s.label}>
              <Card className="flex items-center gap-3 p-4">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl',
                    s.tone === 'brand' && 'bg-brand/20 text-brand-foreground',
                    s.tone === 'accent' && 'bg-accent/10 text-accent',
                    s.tone === 'primary' && 'bg-primary/10 text-primary',
                    s.tone === 'destructive' && 'bg-destructive/10 text-destructive',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-heading text-2xl font-extrabold text-foreground">
                    {s.value === null ? '—' : <AnimatedNumber value={s.value} />}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </Card>
            </StaggerItem>
          )
        })}
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          <DataPendingCard
            title="Assignment terdekat"
            message={assignments.length === 0 ? 'Belum ada assignment published untuk classroom aktif.' : undefined}
            assignments={assignments.slice(0, 3)}
          />
           <DataPendingCard
             title="Rekomendasi adaptif"
             message="Lihat latihan yang dipilih dari histori jawabanmu."
             href="/siswa/adaptive"
           />
           <ActivityCard activities={insights?.recentActivity ?? []} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
           <WeeklyTargetCard target={insights?.weeklyTarget ?? null} />
          <LeaderboardCard rows={leaderboard} currentStudentId={profile?.id} />
        </div>
      </div>
    </div>
  )
}

function ActivityCard({ activities }: { activities: DashboardInsights['recentActivity'] }) {
  return (
    <Card className="p-5">
      <h2 className="font-heading text-base font-bold text-foreground">Aktivitas terbaru</h2>
      {activities.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Belum ada latihan yang tercatat.</p> : (
        <div className="mt-3 space-y-2">
          {activities.map((activity) => <p key={activity.id} className="text-sm text-muted-foreground">{activity.isCorrect ? 'Jawaban benar' : 'Latihan selesai'} · {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString('id-ID') : 'tanggal tidak tersedia'}</p>)}
        </div>
      )}
    </Card>
  )
}

function WeeklyTargetCard({ target }: { target: DashboardInsights['weeklyTarget'] | null }) {
  return (
    <Card className="p-5">
      <h2 className="font-heading text-base font-bold text-foreground">Target mingguan</h2>
      <p className="mt-2 text-sm text-muted-foreground">{target ? `${target.completed} dari ${target.target} latihan tercatat minggu ini.` : 'Target mingguan belum dapat dimuat.'}</p>
      {target && <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${target.completed} dari ${target.target} latihan`}><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (target.completed / target.target) * 100)}%` }} /></div>}
    </Card>
  )
}

function LeaderboardCard({ rows, currentStudentId }: { rows: LeaderboardRow[]; currentStudentId?: string }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-bold text-foreground">Top Kelas</h2>
        <Link href="/siswa/leaderboard" className="text-xs font-semibold text-primary hover:underline">Lihat semua</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Leaderboard tersedia setelah kamu bergabung ke classroom.</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 5).map((row) => (
            <div key={row.studentId} className={cn('flex items-center gap-3 rounded-xl px-2 py-2', row.studentId === currentStudentId && 'bg-primary/10')}>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs font-bold text-muted-foreground">{row.rank}</span>
              <span className="flex-1 truncate text-sm font-medium text-foreground">{row.name}</span>
              <span className="text-sm font-bold text-foreground">{row.xp.toLocaleString('id-ID')} XP</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function DataPendingCard({
  title,
  message,
  href,
  assignments,
}: {
  title: string
  message?: string
  href?: string
  assignments?: DashboardAssignment[]
}) {
  return (
    <Card className="p-5" role="status">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-base font-bold text-foreground">{title}</h2>
        {href && <Link href={href} className="text-xs font-semibold text-primary hover:underline">Buka</Link>}
      </div>
      {assignments && assignments.length > 0 ? (
        <div className="mt-3 space-y-2">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-sm font-semibold text-foreground">{assignment.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {assignment.classroomName} · {assignment.submission?.status ?? 'Belum dikerjakan'}
                {assignment.dueAt ? ` · Deadline ${new Date(assignment.dueAt).toLocaleDateString('id-ID')}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      )}
    </Card>
  )
}

function ClassroomMembershipPanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [joinKey, setJoinKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const response = await fetch('/api/classrooms', { cache: 'no-store' })
    if (!response.ok) {
      setLoading(false)
      return
    }
    const payload = await response.json()
    setClassrooms(payload.data)
    setSelectedClassroomId((current) => current ?? payload.data[0]?.id ?? null)
    setLoading(false)
  }

  async function join() {
    setJoining(true)
    setMessage(null)
    const response = await fetch('/api/classrooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinKey }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setMessage(payload.error?.message ?? 'Gagal bergabung ke classroom')
    } else {
      setJoinKey('')
      setMessage(`Berhasil bergabung ke ${payload.data.name}`)
      await load()
    }
    setJoining(false)
  }

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-bold text-foreground">Classroom saya</h2>
          <p className="mt-1 text-sm text-muted-foreground">Masukkan kode dari guru untuk bergabung ke classroom.</p>
        </div>
        <div className="flex w-full gap-2 sm:max-w-sm">
          <label htmlFor="join-key" className="sr-only">Kode join classroom</label>
          <input id="join-key" value={joinKey} onChange={(event) => setJoinKey(event.target.value)} placeholder="AB12CD34" maxLength={8} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm uppercase tracking-widest" />
          <Button type="button" disabled={joining || joinKey.length === 0} onClick={() => void join()}>{joining ? '...' : 'Gabung'}</Button>
        </div>
      </div>
      {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
      {!loading && classrooms.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {classrooms.map((classroom) => <Badge key={classroom.id} variant={classroom.id === selectedClassroomId ? 'default' : 'secondary'}>{classroom.name}</Badge>)}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">Kelas aktif</span>
            <select
              aria-label="Pilih classroom aktif"
              value={selectedClassroomId ?? ''}
              onChange={(event) => setSelectedClassroomId(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            >
              {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          </label>
        </div>
      )}
    </Card>
  )
}
