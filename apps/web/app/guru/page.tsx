'use client'

import { useEffect, useState } from 'react'
import type { Assignment, Classroom } from '@tuturai/domain'
import { Activity, ArrowUpRight, ClipboardList, GraduationCap, Target, Users } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ChartCard } from '@/components/dashboard/chart-card'
import { FadeIn, FadeInStagger, FadeInItem } from '@/components/dashboard/fade-in'
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
  trend: Array<{ label: string; score: number }>
  skills: Array<{ skill: string; score: number; attempts: number }>
  commonErrors: Array<{ skill: string; errors: number; attempts: number }>
  fluencyDistribution: Array<{ label: string; count: number }>
}

function UnavailableState({ message }: { message: string }) {
  return (
    <div role="status" className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function formatSubmittedAt(value: string | null) {
  if (!value) return 'Waktu tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function TeacherHome() {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([])
  const [reviewQueue, setReviewQueue] = useState<TeacherReviewQueueItem[]>([])
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

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
        const classroomsPayload = await classroomsResponse.json() as ApiResponse<Classroom[]>
        if (!classroomsResponse.ok) {
          throw new Error(classroomsPayload.error?.message ?? 'Gagal memuat classroom')
        }

        const [summaries, reviewResponse, analyticsResponse] = await Promise.all([
          Promise.all(classroomsPayload.data.map(async (classroom) => {
            const [membersResponse, assignmentsResponse] = await Promise.all([
              fetch(`/api/classrooms/${classroom.id}/members`, { cache: 'no-store', signal: controller.signal }),
              fetch(`/api/classrooms/${classroom.id}/assignments`, { cache: 'no-store', signal: controller.signal }),
            ])
            const membersPayload = await membersResponse.json() as ApiResponse<ClassroomMember[]>
            const assignmentsPayload = await assignmentsResponse.json() as ApiResponse<Assignment[]>
            if (!membersResponse.ok) {
              throw new Error(membersPayload.error?.message ?? `Gagal memuat siswa dari ${classroom.name}`)
            }
            if (!assignmentsResponse.ok) {
              throw new Error(assignmentsPayload.error?.message ?? `Gagal memuat penugasan dari ${classroom.name}`)
            }
            return { ...classroom, members: membersPayload.data, assignments: assignmentsPayload.data }
          })),
          fetch('/api/submissions/review-queue', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
            const payload = await response.json() as ApiResponse<TeacherReviewQueueItem[]>
            if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat antrian review')
            return payload.data
          }),
          fetch('/api/teacher/analytics?period=all', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
            if (!response.ok) return null
            const payload = await response.json() as ApiResponse<TeacherAnalytics>
            return payload.data ?? null
          }).catch(() => null),
        ])

        if (!controller.signal.aborted) {
          setClassrooms(summaries)
          setReviewQueue(reviewResponse)
          setAnalytics(analyticsResponse)
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

  const activeClassrooms = classrooms.filter((classroom) => classroom.status === 'active')
  const totalStudents = new Set(classrooms.flatMap((classroom) => classroom.members.map((member) => member.studentId))).size
  const totalAssignments = classrooms.reduce((total, classroom) => total + classroom.assignments.length, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard Guru"
        description="Pantau classroom, penugasan, dan review submission dari satu tempat."
      />

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>Coba lagi</Button>
        </div>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" aria-busy="true">Memuat data dashboard...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Data dashboard belum tersedia.</Card>
      ) : classrooms.length === 0 ? (
        <Card className="p-8 text-center">
          <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-heading text-lg font-bold">Belum ada classroom</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buat classroom untuk mulai melihat data siswa dan penugasan.</p>
          <Button asChild className="mt-4"><Link href="/guru/kelas">Kelola classroom</Link></Button>
        </Card>
      ) : (
        <>
          <FadeInStagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <FadeInItem><KpiCard label="Total Siswa" value={totalStudents} icon={Users} tone="primary" /></FadeInItem>
            <FadeInItem><KpiCard label="Kelas Aktif" value={activeClassrooms.length} icon={GraduationCap} tone="accent" /></FadeInItem>
            <FadeInItem><KpiCard label="Total Penugasan" value={totalAssignments} icon={ClipboardList} tone="brand" /></FadeInItem>
            <FadeInItem><KpiCard label="Menunggu Review" value={reviewQueue.length} icon={Activity} tone="success" /></FadeInItem>
          </FadeInStagger>

          <div className="grid gap-6 lg:grid-cols-3">
            <FadeIn className="lg:col-span-2">
              <ChartCard title="Tren Akurasi Latihan" description="Ringkasan attempt terkonfirmasi dari classroom Anda.">
                {analytics?.trend.length ? <div className="space-y-3" aria-label="Tren akurasi latihan">
                  {analytics.trend.map((point) => <div key={point.label} className="flex items-center gap-3 text-sm"><span className="w-8 font-mono text-xs text-muted-foreground">{point.label}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${point.score}%` }} /></div><span className="w-10 text-right font-medium">{point.score}%</span></div>)}
                </div> : <UnavailableState message="Belum ada attempt latihan terkonfirmasi." />}
              </ChartCard>
            </FadeIn>
            <FadeIn>
              <ChartCard title="Peta Kemampuan Kelas" description="Rata-rata kelas vs target">
                {analytics?.skills.length ? <div className="space-y-4">{analytics.skills.slice(0, 5).map((skill) => <div key={skill.skill}><div className="flex justify-between text-sm"><span className="capitalize">{skill.skill}</span><span>{skill.score}% · {skill.attempts} attempt</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-accent" style={{ width: `${skill.score}%` }} /></div></div>)}</div> : <UnavailableState message="Belum ada data skill terkonfirmasi." />}
              </ChartCard>
            </FadeIn>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <FadeIn className="lg:col-span-2">
              <ChartCard title="Kesalahan Paling Sering" description="Frekuensi tipe kesalahan saat speaking">
                {analytics?.commonErrors.length ? <div className="space-y-3">{analytics.commonErrors.slice(0, 5).map((item) => <div key={item.skill} className="flex items-center justify-between text-sm"><span className="capitalize">{item.skill}</span><span className="font-medium">{item.errors} error</span></div>)}</div> : <UnavailableState message="Belum ada error latihan terdeteksi." />}
              </ChartCard>
            </FadeIn>
            <FadeIn>
             <ChartCard title="Distribusi Kelancaran" description="Sebaran tingkat fluency siswa">
                 {analytics?.fluencyDistribution.some((bucket) => bucket.count > 0) ? <div className="space-y-3" aria-label="Distribusi kelancaran siswa">{analytics.fluencyDistribution.map((bucket) => { const max = Math.max(...analytics.fluencyDistribution.map((item) => item.count), 1); return <div key={bucket.label} className="flex items-center gap-3 text-sm"><span className="w-14 font-mono text-xs text-muted-foreground">{bucket.label}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-accent" style={{ width: `${(bucket.count / max) * 100}%` }} /></div><span className="w-6 text-right font-medium">{bucket.count}</span></div> })}</div> : <UnavailableState message="Belum ada skor fluency terkonfirmasi." />}
              </ChartCard>
            </FadeIn>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <FadeIn className="lg:col-span-2">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold text-foreground">Ringkasan Kelas</h3>
                  <Link href="/guru/kelas" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Kelola kelas <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeClassrooms.map((classroom) => (
                    <Link key={classroom.id} href="/guru/kelas" className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-foreground">{classroom.name}</p>
                        <Badge variant="secondary" className="text-xs">{classroom.members.length} siswa</Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{classroom.assignments.length} penugasan</p>
                    </Link>
                  ))}
                </div>
                {activeClassrooms.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada classroom aktif.</p>}
              </Card>
            </FadeIn>

            <FadeIn>
              <Card className="p-5">
                <h3 className="mb-4 font-heading text-base font-bold text-foreground">Aktivitas Review</h3>
                {reviewQueue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada submission yang menunggu review.</p>
                ) : (
                  <div className="space-y-4">
                    {reviewQueue.slice(0, 5).map((item) => (
                      <div key={item.submission.id} className="flex gap-3">
                        <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs font-semibold">{item.submission.studentId.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.assignment.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.className} · Siswa {item.submission.studentId}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground/70">{formatSubmittedAt(item.submission.submittedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {reviewQueue.length > 5 && <Link href="/guru/penilaian" className="mt-4 inline-flex text-xs font-semibold text-primary hover:underline">Lihat semua review</Link>}
              </Card>
            </FadeIn>
          </div>
        </>
      )}

      {!loading && !error && classrooms.length > 0 && classrooms.every((classroom) => classroom.assignments.length === 0) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" /> Belum ada penugasan pada classroom Anda.</div>
      )}
    </div>
  )
}
