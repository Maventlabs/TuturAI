'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, Building2, CheckCircle2, Mic2, Users } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Card } from '@/components/ui/card'

type Analytics = {
  summary: { classroomCount: number; studentCount: number; practiceAttempts: number; practiceAccuracy: number | null; averageSpeakingScore: number | null }
  trend: { label: string; score: number }[]
  skills: { skill: string; score: number; attempts: number }[]
  commonErrors: { skill: string; errors: number; attempts: number }[]
  attention: { studentId: string; accuracy: number | null; averageSpeakingScore: number | null; reason: string }[]
  classrooms: { id: string; name: string; studentCount: number }[]
  speaking: { available: boolean; assessmentCount: number }
  period: '7d' | '30d' | 'all'
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Analytics['period']>('all')
  const [downloading, setDownloading] = useState(false)

  async function downloadReport() {
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch(`/api/teacher/reports?period=${period}`)
      if (!response.ok) throw new Error('Laporan belum dapat dibuat.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `tuturai-report-${period}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Laporan belum dapat dibuat.')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/teacher/analytics?period=${period}`)
        const payload = await response.json() as { data?: Analytics; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Gagal memuat analitik.')
        setAnalytics(payload.data)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal memuat analitik.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [period])

  return <div className="space-y-8">
    <PageHeader title="Analitik Mendalam" description="Performa latihan dan assessment dari siswa di kelas yang Anda kelola."><select aria-label="Periode analitik" value={period} onChange={(event) => { setLoading(true); setError(null); setPeriod(event.target.value as Analytics['period']) }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="7d">7 hari</option><option value="30d">30 hari</option><option value="all">Semua waktu</option></select><button type="button" onClick={() => void downloadReport()} disabled={downloading} className="h-10 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60">{downloading ? 'Menyiapkan...' : 'Unduh PDF'}</button></PageHeader>
    {error && <Card className="border-destructive/40 p-4 text-sm text-destructive">{error}</Card>}
    {loading && <Card className="p-6 text-sm text-muted-foreground">Memuat analitik dari Firestore...</Card>}
    {!loading && !error && analytics && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Kelas" value={analytics.summary.classroomCount} icon={Building2} tone="primary" />
        <KpiCard label="Total Siswa" value={analytics.summary.studentCount} icon={Users} tone="accent" />
        <KpiCard label="Akurasi Latihan" value={analytics.summary.practiceAccuracy === null ? 'Belum ada' : `${analytics.summary.practiceAccuracy}%`} icon={CheckCircle2} tone="primary" />
        <KpiCard label="Speaking Score" value={analytics.summary.averageSpeakingScore === null ? 'Belum ada' : `${analytics.summary.averageSpeakingScore}%`} icon={Mic2} tone="accent" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-brand" /><h2 className="font-semibold text-foreground">Tren akurasi latihan</h2></div>
          {analytics.trend.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">Belum ada attempt latihan untuk dibuatkan tren.</p> : <div className="mt-6 space-y-3">{analytics.trend.map((point) => <div key={point.label} className="flex items-center gap-3 text-sm"><span className="w-8 font-mono text-xs text-muted-foreground">{point.label}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand" style={{ width: `${point.score}%` }} /></div><span className="w-10 text-right font-medium">{point.score}%</span></div>)}</div>}
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Performa per skill</h2>
          {analytics.skills.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">Belum ada data skill.</p> : <div className="mt-5 space-y-4">{analytics.skills.map((skill) => <div key={skill.skill}><div className="flex justify-between text-sm"><span className="capitalize">{skill.skill}</span><span className="font-medium">{skill.score}% · {skill.attempts} attempt</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-accent" style={{ width: `${skill.score}%` }} /></div></div>)}</div>}
        </Card>
      </div>
      <Card className="p-6">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-brand" /><div><h2 className="font-semibold text-foreground">Batasan data speaking</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{analytics.speaking.available ? `${analytics.speaking.assessmentCount} assessment speaking berhasil dihitung.` : 'Belum ada assessment speaking yang tersimpan. TuturAI tidak mengisi skor dengan data contoh.'}</p></div></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><h2 className="font-semibold text-foreground">Common errors</h2>{analytics.commonErrors.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Belum ada error terdeteksi.</p> : <div className="mt-4 space-y-3">{analytics.commonErrors.slice(0, 5).map((item) => <div key={item.skill} className="flex items-center justify-between text-sm"><span className="capitalize">{item.skill}</span><span className="font-medium">{item.errors} error</span></div>)}</div>}</Card>
        <Card className="p-6"><h2 className="font-semibold text-foreground">Perlu perhatian</h2>{analytics.attention.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Belum ada siswa dalam zona perhatian.</p> : <div className="mt-4 space-y-3">{analytics.attention.slice(0, 5).map((student) => <div key={student.studentId} className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">{student.studentId}</p><p className="mt-1 text-xs text-muted-foreground">{student.reason}</p></div>)}</div>}</Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{analytics.classrooms.map((classroom) => <Card key={classroom.id} className="p-5"><p className="font-semibold text-foreground">{classroom.name}</p><p className="mt-1 text-sm text-muted-foreground">{classroom.studentCount} anggota terdaftar</p></Card>)}</div>
      {analytics.summary.classroomCount === 0 && <Card className="p-6 text-sm text-muted-foreground">Belum ada kelas aktif. Buat kelas untuk mulai melihat analitik.</Card>}
    </>}
  </div>
}
