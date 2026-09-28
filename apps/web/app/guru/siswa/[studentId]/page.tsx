'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/dashboard/page-header'

type StudentDetails = {
  student: { id: string; name: string; email: string | null; level: number | null; streak: number | null; speakingScore: number | null }
  classrooms: { id: string; name: string; joinedAt: string }[]
}

type StudentAnalytics = {
  summary: { classroomCount: number; studentCount: number; practiceAttempts: number; practiceAccuracy: number | null; averageSpeakingScore: number | null }
  trend: { label: string; score: number }[]
  skills: { skill: string; score: number; attempts: number }[]
  commonErrors: { skill: string; errors: number; attempts: number }[]
  speaking: { available: boolean; assessmentCount: number }
  period: '7d' | '30d' | 'all'
}

type ApiResult<T> = { data?: T; error?: { message?: string } }

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [details, setDetails] = useState<StudentDetails | null>(null)
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [profileResponse, analyticsResponse] = await Promise.all([
          fetch(`/api/teacher/students/${encodeURIComponent(studentId)}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`/api/teacher/analytics?studentId=${encodeURIComponent(studentId)}&period=all`, { cache: 'no-store', signal: controller.signal }),
        ])
        const [profilePayload, analyticsPayload] = await Promise.all([
          profileResponse.json() as Promise<ApiResult<StudentDetails>>,
          analyticsResponse.json() as Promise<ApiResult<StudentAnalytics>>,
        ])
        if (!profileResponse.ok || !profilePayload.data) throw new Error(profilePayload.error?.message ?? 'Detail siswa tidak dapat dimuat.')
        if (!analyticsResponse.ok || !analyticsPayload.data) throw new Error(analyticsPayload.error?.message ?? 'Analitik siswa tidak dapat dimuat.')
        setDetails(profilePayload.data)
        setAnalytics(analyticsPayload.data)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Detail siswa tidak dapat dimuat.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (studentId) void load()
    return () => controller.abort()
  }, [studentId])

  return (
    <div className="space-y-6">
      <PageHeader
        title={details?.student.name ?? 'Detail siswa'}
        description="Perkembangan belajar berdasarkan data server dan classroom yang dikelola guru."
      >
        <Link href="/guru/siswa" className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary">
          Kembali ke daftar siswa
        </Link>
      </PageHeader>

      {loading && <Card role="status" aria-busy="true" className="p-5 text-sm text-muted-foreground">Memuat detail siswa dari server...</Card>}
      {error && <Card role="alert" className="border-destructive/40 p-5 text-sm text-destructive">{error}</Card>}
      {!loading && !error && details && analytics && <>
        <Card className="p-5">
          <h2 className="font-heading text-base font-semibold text-foreground">Profil belajar</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all text-sm font-medium text-foreground">{details.student.email ?? 'Tidak tersedia'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Level</dt><dd className="mt-1 text-sm font-medium text-foreground">{details.student.level ?? 'Belum tersedia'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Streak</dt><dd className="mt-1 text-sm font-medium text-foreground">{details.student.streak === null ? 'Belum tersedia' : `${details.student.streak} hari`}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Speaking score</dt><dd className="mt-1 text-sm font-medium text-foreground">{details.student.speakingScore === null ? 'Belum ada assessment' : `${details.student.speakingScore}/100`}</dd></div>
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Classroom aktif</h3>
            {details.classrooms.length ? <ul className="mt-2 flex flex-wrap gap-2">{details.classrooms.map((classroom) => <li key={classroom.id} className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground">{classroom.name}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Siswa belum terdaftar di classroom aktif.</p>}
          </div>
        </Card>

        <section aria-labelledby="student-analytics-title" className="space-y-4">
          <h2 id="student-analytics-title" className="font-heading text-base font-semibold text-foreground">Analitik pembelajaran</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total attempt" value={String(analytics.summary.practiceAttempts)} />
            <Metric label="Akurasi latihan" value={analytics.summary.practiceAccuracy === null ? 'Belum tersedia' : `${analytics.summary.practiceAccuracy}%`} />
            <Metric label="Rata-rata speaking" value={analytics.summary.averageSpeakingScore === null ? 'Belum ada assessment' : `${analytics.summary.averageSpeakingScore}%`} />
            <Metric label="Assessment tersimpan" value={analytics.speaking.available ? String(analytics.speaking.assessmentCount) : 'Belum tersedia'} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold text-foreground">Tren akurasi</h3>
              {analytics.trend.length ? <ul className="mt-4 space-y-3">{analytics.trend.map((point) => <li key={point.label} className="flex items-center gap-3 text-sm"><span className="w-12 text-xs text-muted-foreground">{point.label}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${point.score}%` }} /></div><span className="w-12 text-right font-medium text-foreground">{point.score}%</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Belum ada data latihan untuk tren.</p>}
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-foreground">Performa per skill</h3>
              {analytics.skills.length ? <ul className="mt-4 space-y-3">{analytics.skills.map((skill) => <li key={skill.skill} className="flex items-center justify-between gap-3 text-sm"><span className="capitalize text-foreground">{skill.skill}</span><span className="text-muted-foreground">{skill.score}% · {skill.attempts} attempt</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Belum ada data skill tersimpan.</p>}
            </Card>
          </div>
          <Card className="p-5">
            <h3 className="font-semibold text-foreground">Kesulitan yang sering muncul</h3>
            {analytics.commonErrors.length ? <ul className="mt-3 space-y-2">{analytics.commonErrors.map((item) => <li key={item.skill} className="flex justify-between gap-3 text-sm"><span className="capitalize text-foreground">{item.skill}</span><span className="text-muted-foreground">{item.errors} dari {item.attempts} attempt</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Belum ada pola kesulitan yang dapat disimpulkan.</p>}
          </Card>
        </section>
      </>}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-base font-semibold text-foreground">{value}</p></Card>
}
