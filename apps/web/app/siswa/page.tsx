'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { Classroom } from '@tuturai/domain'
import {
  ArrowUpRight,
  AudioLines,
  BookText,
  Check,
  Headphones,
  ListChecks,
  Mic,
  Route,
} from 'lucide-react'
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

const LEARNING_MODES = [
  { label: 'Speaking Practice', href: '/siswa/speaking', icon: Mic, meta: 'Rekam & dinilai AI' },
  { label: 'Pronunciation Lab', href: '/siswa/pronunciation', icon: AudioLines, meta: 'Fonem & intonasi' },
  { label: 'Vocabulary', href: '/siswa/vocabulary', icon: BookText, meta: 'Kartu kata adaptif' },
  { label: 'Listening', href: '/siswa/listening', icon: Headphones, meta: 'Audio bertingkat' },
  { label: 'Quiz', href: '/siswa/quiz', icon: ListChecks, meta: 'Kuis terpadu' },
  { label: 'Adaptive Path', href: '/siswa/adaptive', icon: Route, meta: 'Modul sesuai level' },
]

const DAY_INITIALS = ['S', 'S', 'R', 'K', 'J', 'S', 'M']

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function StudentHomePage() {
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(() => (
    typeof window === 'undefined' ? null : window.localStorage.getItem('tuturai.activeClassroomId')
  ))
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [assignments, setAssignments] = useState<DashboardAssignment[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [insights, setInsights] = useState<DashboardInsights | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      try {
        const query = selectedClassroomId ? `?classroomId=${encodeURIComponent(selectedClassroomId)}` : ''
        const response = await fetch(`/api/student/dashboard${query}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('PROFILE_LOAD_FAILED')
        const payload = (await response.json()) as {
          data?: {
            profile?: StudentProfile
            assignments?: DashboardAssignment[]
            leaderboard?: LeaderboardRow[]
            insights?: DashboardInsights
          }
        }
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
  }, [selectedClassroomId])

  const week = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    const practised = new Set(
      (insights?.recentActivity ?? [])
        .map((activity) => (activity.createdAt ? new Date(activity.createdAt).toDateString() : null))
        .filter((value): value is string => Boolean(value)),
    )

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + index)
      return {
        initial: DAY_INITIALS[index],
        active: practised.has(day.toDateString()),
        today: day.toDateString() === now.toDateString(),
      }
    })
  }, [insights])

  const target = insights?.weeklyTarget ?? null
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Siswa'
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const nextSession = assignments[0]
    ? {
        label: assignments[0].title,
        meta: [assignments[0].classroomName, assignments[0].dueAt ? `tenggat ${shortDate(assignments[0].dueAt)}` : null]
          .filter(Boolean)
          .join(' · '),
        href: '/siswa/penugasan',
        cta: 'Buka tugas',
      }
    : {
        label: 'Speaking Practice',
        meta: 'Latihan bebas · sekitar 5 menit',
        href: '/siswa/speaking',
        cta: 'Mulai sesi',
      }

  const stats = [
    { label: 'Level', value: profile?.level ?? null, format: (n: number) => String(n).padStart(2, '0') },
    { label: 'Total XP', value: profile?.xp ?? null, format: (n: number) => n.toLocaleString('id-ID') },
    { label: 'Peringkat', value: profile?.rank ?? null, format: (n: number) => `#${n}` },
    { label: 'Streak', value: profile?.streak ?? null, format: (n: number) => String(n), unit: 'hari' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      {/* Session console — the day's state and the one action that matters. */}
      <section className="pb-8">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{todayLabel}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {profile ? `Level ${String(profile.level).padStart(2, '0')}` : 'Memuat…'}
          </p>
        </div>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <h1 className="font-display text-[2.5rem] leading-[1.04] tracking-[-0.02em] text-foreground sm:text-[3.25rem]">
              {greeting()},
              <br />
              {firstName}.
            </h1>
            <p className="mt-4 max-w-sm text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {profile?.streak
                ? `Kamu sudah berlatih ${profile.streak} hari berturut-turut. Satu sesi lagi hari ini menjaga ritmenya.`
                : 'Belum ada streak hari ini. Satu sesi singkat sudah cukup untuk memulai.'}
            </p>
            {profileError && (
              <p role="alert" className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
                Profil belum dapat dimuat dari server
              </p>
            )}
          </div>

          <div className="border border-rule bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sesi berikutnya</p>
            <p className="mt-2.5 text-balance font-heading text-[17px] font-bold leading-snug text-foreground">
              {nextSession.label}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{nextSession.meta}</p>
            <Link
              href={nextSession.href}
              className="mt-5 flex h-10 w-full items-center justify-between rounded-full bg-ink-deep px-4 text-[13px] font-semibold text-ink-foreground transition-colors hover:bg-ink-deep/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {nextSession.cta}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Instrument strip — four readouts divided by hairlines, not four cards. */}
      <section aria-label="Ringkasan progres" className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card px-4 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5 font-mono text-[1.9rem] leading-none tabular-nums text-foreground">
              {stat.value === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                stat.format(stat.value)
              )}
              {stat.unit && stat.value !== null && (
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{stat.unit}</span>
              )}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-9 grid gap-9 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-9">
          {/* Week matrix */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Minggu ini</h2>
              <p className="font-mono text-[11px] tabular-nums text-foreground">
                {target ? `${target.completed} / ${target.target}` : '—'}
                <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">latihan</span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {week.map((day, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      'h-16 w-full border',
                      day.active ? 'border-primary bg-primary' : 'border-rule bg-card',
                      day.today && !day.active && 'border-foreground/40',
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase',
                      day.today ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {day.initial}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {target
                ? target.completed >= target.target
                  ? 'Target mingguan tercapai. Latihan tambahan tetap dihitung ke XP.'
                  : `${target.target - target.completed} latihan lagi untuk memenuhi target mingguan.`
                : 'Target mingguan belum dapat dimuat.'}
            </p>
          </section>

          {/* Assignment queue */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Antrean tugas</h2>
              <Link
                href="/siswa/penugasan"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep hover:underline"
              >
                Semua
              </Link>
            </div>
            <div className="mt-3 border-t border-rule">
              {assignments.length === 0 ? (
                <p className="py-4 text-[13px] leading-relaxed text-muted-foreground">
                  Belum ada tugas published untuk classroom aktif.
                </p>
              ) : (
                assignments.slice(0, 4).map((assignment) => {
                  const done = Boolean(assignment.submission)

                  return (
                    <Link
                      key={assignment.id}
                      href="/siswa/penugasan"
                      className="flex items-start gap-3 border-b border-rule py-3.5 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center border',
                          done ? 'border-primary bg-primary text-primary-foreground' : 'border-rule',
                        )}
                        aria-hidden="true"
                      >
                        {done && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-foreground">
                          {assignment.title}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {assignment.classroomName}
                          {assignment.dueAt ? ` · ${shortDate(assignment.dueAt)}` : ''}
                          {assignment.submission ? ` · ${assignment.submission.status}` : ' · belum dikerjakan'}
                        </span>
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </section>
        </div>

        <div className="space-y-9">
          {/* Standings */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Klasemen kelas
              </h2>
              <Link
                href="/siswa/leaderboard"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep hover:underline"
              >
                Semua
              </Link>
            </div>
            <div className="mt-3 border-t border-rule">
              {leaderboard.length === 0 ? (
                <p className="py-4 text-[13px] leading-relaxed text-muted-foreground">
                  Klasemen tersedia setelah kamu bergabung ke classroom.
                </p>
              ) : (
                leaderboard.slice(0, 5).map((row) => {
                  const me = row.studentId === profile?.id

                  return (
                    <div
                      key={row.studentId}
                      className={cn(
                        'flex items-center gap-3 border-b border-rule py-2.5',
                        me && 'border-l-2 border-l-primary pl-2',
                      )}
                    >
                      <span className="w-5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {String(row.rank).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13px] text-foreground',
                          me && 'font-semibold',
                        )}
                      >
                        {row.name}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {row.xp.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <ClassroomPanel
            selectedClassroomId={selectedClassroomId}
            onSelectedClassroom={(classroomId) => {
              window.localStorage.setItem('tuturai.activeClassroomId', classroomId)
              setSelectedClassroomId(classroomId)
            }}
          />
        </div>
      </div>

      {/* Launcher — the practice modes the dock no longer carries. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mode latihan</h2>
          <Link
            href="/siswa/belajar"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary-deep hover:underline"
          >
            Learning
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3">
          {LEARNING_MODES.map((mode) => {
            const Icon = mode.icon

            return (
              <Link
                key={mode.href}
                href={mode.href}
                className="flex items-start gap-3 bg-card p-4 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary-deep" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">{mode.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {mode.meta}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ClassroomPanel({
  selectedClassroomId,
  onSelectedClassroom,
}: {
  selectedClassroomId: string | null
  onSelectedClassroom: (classroomId: string) => void
}) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [joinKey, setJoinKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

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
    if (!selectedClassroomId && payload.data[0]?.id) onSelectedClassroom(payload.data[0].id)
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
    <section>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Classroom</h2>
      <div className="mt-3 border-t border-rule pt-4">
        {!loading && classrooms.length > 0 && (
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Kelas aktif
            </span>
            <select
              aria-label="Pilih classroom aktif"
              value={selectedClassroomId ?? ''}
              onChange={(event) => onSelectedClassroom(event.target.value)}
              className="mt-1.5 h-9 w-full border border-rule bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            >
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-3 flex gap-2">
          <label htmlFor="join-key" className="sr-only">
            Kode join classroom
          </label>
          <input
            id="join-key"
            value={joinKey}
            onChange={(event) => setJoinKey(event.target.value)}
            placeholder="AB12CD34"
            maxLength={8}
            className="h-9 min-w-0 flex-1 border border-rule bg-card px-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
          />
          <button
            type="button"
            disabled={joining || joinKey.length === 0}
            onClick={() => void join()}
            className="h-9 shrink-0 rounded-full bg-ink-deep px-4 text-[12px] font-semibold text-ink-foreground transition-colors hover:bg-ink-deep/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {joining ? '…' : 'Gabung'}
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Masukkan kode dari guru
        </p>
        {message && (
          <p role="status" className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
