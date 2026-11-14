'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Assignment, Classroom } from '@tuturai/domain'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, EmptyNote } from '@/components/guru/overview/panel'
import { ReadoutStrip, type Readout } from '@/components/guru/overview/readout-strip'
import { AccuracyTrend } from '@/components/guru/overview/accuracy-trend'
import { SkillMap } from '@/components/guru/overview/skill-map'
import { ErrorRanking } from '@/components/guru/overview/error-ranking'
import { FluencyHistogram } from '@/components/guru/overview/fluency-histogram'
import { AttentionList } from '@/components/guru/overview/attention-list'
import { ReviewQueue } from '@/components/guru/overview/review-queue'
import { ClassRoster } from '@/components/guru/overview/class-roster'
import { PeriodSwitch, type AnalyticsPeriod } from '@/components/guru/overview/period-switch'
import type { TeacherReviewQueueItem } from '@/lib/submissions'

type ClassroomMember = {
  studentId: string
  name: string
  email: string | null
  joinedAt: string
}

type ApiResponse<T> = {
  data: T
  error?: { message?: string }
}

type ClassroomSummary = Classroom & {
  members: ClassroomMember[]
  assignments: Assignment[]
}

type TeacherAnalytics = {
  summary: {
    classroomCount: number
    studentCount: number
    practiceAttempts: number
    practiceAccuracy: number | null
    averageSpeakingScore: number | null
  }
  period: AnalyticsPeriod
  trend: Array<{ label: string; score: number }>
  skills: Array<{ skill: string; score: number; attempts: number }>
  commonErrors: Array<{ skill: string; errors: number; attempts: number }>
  fluencyDistribution: Array<{ label: string; count: number }>
  classrooms: Array<{ id: string; name: string; studentCount: number }>
  speaking: { available: boolean; assessmentCount: number }
  attention: Array<{
    studentId: string
    accuracy: number | null
    averageSpeakingScore: number | null
    reason: string
  }>
}

const TARGET = 75

// The date is formatted in the viewer's timezone, so it is read only after
// hydration — the server snapshot stays null to keep SSR and client in sync.
const subscribeToNothing = () => () => {}
const getTodayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

function buildInsight(input: {
  classroomCount: number
  activeCount: number
  studentCount: number
  attempts: number
  accuracy: number | null
  speaking: number | null
  attentionCount: number
}) {
  const { classroomCount, activeCount, studentCount, attempts, accuracy, speaking, attentionCount } = input

  if (classroomCount === 0) {
    return 'Belum ada kelas. Buat kelas pertama untuk mulai mengukur kemampuan speaking siswa.'
  }
  if (attempts === 0 && speaking === null) {
    return `${activeCount} kelas aktif dengan ${studentCount} siswa, tapi belum ada latihan terkonfirmasi. Panel di bawah terisi setelah penugasan pertama dikerjakan.`
  }
  if (attempts > 0 && speaking !== null) {
    const base = `Akurasi latihan ${accuracy}% dari ${attempts} attempt, dengan skor speaking rata-rata ${speaking}.`
    return attentionCount > 0
      ? `${base} ${attentionCount} siswa perlu perhatian.`
      : `${base} Tidak ada siswa yang perlu perhatian khusus.`
  }
  if (attempts > 0) {
    return `Akurasi latihan ${accuracy}% dari ${attempts} attempt. Sesi speaking belum dinilai.`
  }
  return `Rata-rata skor speaking ${speaking} dari sesi yang sudah dinilai. Latihan kuis belum tercatat.`
}

export default function TeacherHome() {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([])
  const [reviewQueue, setReviewQueue] = useState<TeacherReviewQueueItem[]>([])
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const today = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      setLoading(true)
      setError(null)

      try {
        const classroomsResponse = await fetch('/api/classrooms', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const classroomsPayload = (await classroomsResponse.json()) as ApiResponse<Classroom[]>
        if (!classroomsResponse.ok) {
          throw new Error(classroomsPayload.error?.message ?? 'Gagal memuat classroom')
        }

        const [summaries, reviewResponse] = await Promise.all([
          Promise.all(
            classroomsPayload.data.map(async (classroom) => {
              const [membersResponse, assignmentsResponse] = await Promise.all([
                fetch(`/api/classrooms/${classroom.id}/members`, { cache: 'no-store', signal: controller.signal }),
                fetch(`/api/classrooms/${classroom.id}/assignments`, { cache: 'no-store', signal: controller.signal }),
              ])
              const membersPayload = (await membersResponse.json()) as ApiResponse<ClassroomMember[]>
              const assignmentsPayload = (await assignmentsResponse.json()) as ApiResponse<Assignment[]>
              if (!membersResponse.ok) {
                throw new Error(membersPayload.error?.message ?? `Gagal memuat siswa dari ${classroom.name}`)
              }
              if (!assignmentsResponse.ok) {
                throw new Error(assignmentsPayload.error?.message ?? `Gagal memuat penugasan dari ${classroom.name}`)
              }
              return { ...classroom, members: membersPayload.data, assignments: assignmentsPayload.data }
            }),
          ),
          fetch('/api/submissions/review-queue', { cache: 'no-store', signal: controller.signal }).then(
            async (response) => {
              const payload = (await response.json()) as ApiResponse<TeacherReviewQueueItem[]>
              if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat antrian review')
              return payload.data
            },
          ),
        ])

        if (!controller.signal.aborted) {
          setClassrooms(summaries)
          setReviewQueue(reviewResponse)
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat dashboard guru')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadDashboard()
    return () => controller.abort()
  }, [reloadToken])

  useEffect(() => {
    const controller = new AbortController()

    async function loadAnalytics() {
      try {
        const response = await fetch(`/api/teacher/analytics?period=${period}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json()) as ApiResponse<TeacherAnalytics>
        if (!controller.signal.aborted) setAnalytics(payload.data ?? null)
      } catch {
        // Analytics is supplementary — classroom data still renders without it.
      }
    }

    void loadAnalytics()
    return () => controller.abort()
  }, [period, reloadToken])

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const classroom of classrooms) {
      for (const member of classroom.members) {
        if (!map.has(member.studentId)) map.set(member.studentId, member.name)
      }
    }
    return map
  }, [classrooms])

  const activeClassrooms = classrooms.filter((classroom) => classroom.status === 'active')
  const totalStudents = new Set(
    classrooms.flatMap((classroom) => classroom.members.map((member) => member.studentId)),
  ).size
  const totalAssignments = classrooms.reduce((total, classroom) => total + classroom.assignments.length, 0)

  const summary = analytics?.summary
  const attempts = summary?.practiceAttempts ?? 0
  const accuracy = summary?.practiceAccuracy ?? null
  const speaking = summary?.averageSpeakingScore ?? null
  const assessmentCount = analytics?.speaking.assessmentCount ?? 0
  const attention = analytics?.attention ?? []
  const fluencyTotal = (analytics?.fluencyDistribution ?? []).reduce((total, bucket) => total + bucket.count, 0)

  const insight = buildInsight({
    classroomCount: classrooms.length,
    activeCount: activeClassrooms.length,
    studentCount: totalStudents,
    attempts,
    accuracy,
    speaking,
    attentionCount: attention.length,
  })

  const readouts: Readout[] = [
    { label: 'Siswa', value: String(totalStudents), note: `${classrooms.length} kelas` },
    {
      label: 'Kelas Aktif',
      value: String(activeClassrooms.length),
      note: `${totalAssignments} penugasan`,
    },
    {
      label: 'Akurasi Latihan',
      value: accuracy === null ? '—' : String(accuracy),
      unit: accuracy === null ? undefined : '%',
      note: `${attempts} attempt`,
    },
    {
      label: 'Skor Speaking',
      value: speaking === null ? '—' : String(speaking),
      note: `${assessmentCount} sesi dinilai`,
    },
    {
      label: 'Menunggu Review',
      value: String(reviewQueue.length),
      note: 'submission',
      tone: reviewQueue.length > 0 ? 'attention' : 'default',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-rule px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Ringkasan Kelas{today ? ` · ${today}` : ''}
            </p>
            <PeriodSwitch value={period} onChange={setPeriod} />
          </div>
          <h1 className="mt-4 max-w-[48ch] text-balance font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
            {loading ? 'Memuat data kelas…' : insight}
          </h1>
        </div>

        <ReadoutStrip items={readouts} />

        {loading ? (
          <div className="border-t border-rule px-5 py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Memuat panel
          </div>
        ) : classrooms.length === 0 ? (
          <div className="border-t border-rule px-5 py-10">
            <EmptyNote
              title="Belum ada kelas"
              description="Buat kelas, undang siswa, lalu tugaskan latihan speaking. Seluruh panel di halaman ini akan terisi otomatis."
              action={
                <Button asChild size="sm">
                  <Link href="/guru/kelas">Buat kelas</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px border-t border-rule bg-rule lg:grid-cols-3">
            <Panel label="Tren Akurasi Latihan" meta={`${attempts} attempt`} className="lg:col-span-2">
              <AccuracyTrend points={analytics?.trend ?? []} target={TARGET} />
            </Panel>

            <Panel label="Peta Kemampuan" meta={`target ${TARGET}`}>
              {analytics?.skills.length ? (
                <SkillMap items={analytics.skills.slice(0, 5)} target={TARGET} />
              ) : (
                <EmptyNote
                  title="Belum ada data skill"
                  description="Peta terisi setelah siswa menjawab soal pada latihan kuis."
                />
              )}
            </Panel>

            <Panel label="Kesalahan Paling Sering" meta={`${analytics?.commonErrors.length ?? 0} tipe`}>
              {analytics?.commonErrors.length ? (
                <ErrorRanking items={analytics.commonErrors.slice(0, 5)} />
              ) : (
                <EmptyNote
                  title="Belum ada error terdeteksi"
                  description="Tipe kesalahan muncul dari jawaban yang salah pada latihan."
                />
              )}
            </Panel>

            <Panel label="Distribusi Kelancaran" meta="fluency">
              {fluencyTotal > 0 ? (
                <FluencyHistogram buckets={analytics?.fluencyDistribution ?? []} />
              ) : (
                <EmptyNote
                  title="Belum ada skor fluency"
                  description="Butuh sesi speaking yang sudah dinilai provider."
                />
              )}
            </Panel>

            <Panel label="Perlu Perhatian" meta={`${attention.length} siswa`}>
              {attention.length ? (
                <AttentionList
                  items={attention.slice(0, 5).map((item) => ({
                    ...item,
                    name: studentNames.get(item.studentId) ?? 'Siswa',
                  }))}
                />
              ) : (
                <EmptyNote
                  title="Tidak ada siswa berisiko"
                  description="Siswa muncul di sini bila akurasi latihan atau skor speaking di bawah 60."
                />
              )}
            </Panel>

            <Panel
              label="Ringkasan Kelas"
              className="lg:col-span-2"
              action={
                <Link
                  href="/guru/kelas"
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                >
                  Kelola <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            >
              <ClassRoster
                items={classrooms.map((classroom) => ({
                  id: classroom.id,
                  name: classroom.name,
                  status: classroom.status,
                  studentCount: classroom.members.length,
                  assignmentCount: classroom.assignments.length,
                }))}
              />
            </Panel>

            <Panel
              label="Aktivitas Review"
              action={
                reviewQueue.length > 0 ? (
                  <Link
                    href="/guru/penilaian"
                    className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                  >
                    Buka <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">0 menunggu</span>
                )
              }
            >
              {reviewQueue.length ? (
                <ReviewQueue items={reviewQueue.slice(0, 5)} names={studentNames} />
              ) : (
                <EmptyNote
                  title="Antrian review kosong"
                  description="Submission siswa yang menunggu penilaian akan muncul di sini."
                />
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
