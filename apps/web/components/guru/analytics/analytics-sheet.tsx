'use client'

import Link from 'next/link'
import { ArrowUpRight, Download } from 'lucide-react'
import { Panel, EmptyNote } from '@/components/guru/overview/panel'
import { ReadoutStrip, type Readout } from '@/components/guru/overview/readout-strip'
import { PeriodSwitch, type AnalyticsPeriod } from '@/components/guru/overview/period-switch'
import { ErrorRanking } from '@/components/guru/overview/error-ranking'
import { FluencyHistogram } from '@/components/guru/overview/fluency-histogram'
import { AttentionList } from '@/components/guru/overview/attention-list'
import { AccuracyCurve } from '@/components/guru/analytics/accuracy-curve'
import { SkillLedger } from '@/components/guru/analytics/skill-ledger'
import { EvidenceCoverage, type EvidenceRow } from '@/components/guru/analytics/evidence-coverage'
import { ClassroomSpread } from '@/components/guru/analytics/classroom-spread'
import { NextSteps } from '@/components/guru/analytics/next-steps'

export type AnalyticsData = {
  summary: {
    classroomCount: number
    studentCount: number
    practiceAttempts: number
    practiceAccuracy: number | null
    averageSpeakingScore: number | null
  }
  trend: Array<{ label: string; score: number }>
  skills: Array<{ skill: string; score: number; attempts: number }>
  commonErrors: Array<{ skill: string; errors: number; attempts: number }>
  fluencyDistribution: Array<{ label: string; count: number }>
  attention: Array<{
    studentId: string
    accuracy: number | null
    averageSpeakingScore: number | null
    reason: string
  }>
  classrooms: Array<{ id: string; name: string; studentCount: number }>
  speaking: { available: boolean; assessmentCount: number }
  period: AnalyticsPeriod
}

export const TARGET = 75

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  '7d': '7 hari terakhir',
  '30d': '30 hari terakhir',
  all: 'seluruh riwayat',
}

function buildInsight(input: {
  classroomCount: number
  studentCount: number
  attempts: number
  accuracy: number | null
  speaking: number | null
  attentionCount: number
}) {
  const { classroomCount, studentCount, attempts, accuracy, speaking, attentionCount } = input

  if (classroomCount === 0) {
    return 'Belum ada kelas. Analitik terbentuk setelah kelas pertama dibuat dan latihan pertama dikerjakan.'
  }
  if (attempts === 0 && speaking === null) {
    return `${classroomCount} kelas dengan ${studentCount} siswa sudah terhubung, tapi belum ada latihan terkonfirmasi. Panel di bawah menampilkan status bukti, bukan skor contoh.`
  }
  if (attempts > 0 && speaking !== null) {
    const base = `Akurasi latihan ${accuracy}% dari ${attempts} attempt, dengan skor speaking rata-rata ${speaking}.`
    return attentionCount > 0
      ? `${base} ${attentionCount} siswa masih di bawah ambang 60.`
      : `${base} Tidak ada siswa di bawah ambang 60.`
  }
  if (attempts > 0) {
    return `Akurasi latihan ${accuracy}% dari ${attempts} attempt. Sesi speaking belum dinilai, jadi skor speaking dibiarkan kosong.`
  }
  return `Rata-rata skor speaking ${speaking} dari sesi yang sudah dinilai. Latihan kuis belum tercatat pada rentang ini.`
}

interface AnalyticsSheetProps {
  analytics: AnalyticsData | null
  names: Map<string, string>
  period: AnalyticsPeriod
  onPeriodChange: (period: AnalyticsPeriod) => void
  onDownload: () => void
  downloading: boolean
  loading: boolean
  error: string | null
  onRetry: () => void
  today: string | null
}

export function AnalyticsSheet({
  analytics,
  names,
  period,
  onPeriodChange,
  onDownload,
  downloading,
  loading,
  error,
  onRetry,
  today,
}: AnalyticsSheetProps) {
  const summary = analytics?.summary
  const attempts = summary?.practiceAttempts ?? 0
  const accuracy = summary?.practiceAccuracy ?? null
  const speaking = summary?.averageSpeakingScore ?? null
  const assessmentCount = analytics?.speaking.assessmentCount ?? 0
  const attention = analytics?.attention ?? []
  const fluencyTotal = (analytics?.fluencyDistribution ?? []).reduce((total, bucket) => total + bucket.count, 0)
  const totalErrors = (analytics?.commonErrors ?? []).reduce((total, item) => total + item.errors, 0)
  const hasActivity = attempts > 0 || assessmentCount > 0

  const insight = buildInsight({
    classroomCount: summary?.classroomCount ?? 0,
    studentCount: summary?.studentCount ?? 0,
    attempts,
    accuracy,
    speaking,
    attentionCount: attention.length,
  })

  const readouts: Readout[] = [
    {
      label: 'Kelas',
      value: String(summary?.classroomCount ?? 0),
      note: `${summary?.studentCount ?? 0} siswa`,
    },
    {
      label: 'Siswa',
      value: String(summary?.studentCount ?? 0),
      note: 'terdaftar',
    },
    {
      label: 'Attempt',
      value: String(attempts),
      note: 'latihan kuis',
    },
    {
      label: 'Akurasi',
      value: accuracy === null ? '—' : String(accuracy),
      unit: accuracy === null ? undefined : '%',
      note: `target ${TARGET}%`,
      tone: accuracy !== null && accuracy < TARGET ? 'attention' : 'default',
    },
    {
      label: 'Speaking',
      value: speaking === null ? '—' : String(speaking),
      note: `${assessmentCount} sesi dinilai`,
    },
  ]

  const evidenceRows: EvidenceRow[] = [
    {
      dimension: 'Akurasi latihan',
      status: attempts > 0 ? 'measured' : 'insufficient',
      detail: attempts > 0 ? `${attempts} attempt terekam pada rentang ini.` : 'Belum ada attempt pada rentang ini.',
    },
    {
      dimension: 'Skor speaking',
      status: assessmentCount > 0 ? 'measured' : 'insufficient',
      detail:
        assessmentCount > 0
          ? `${assessmentCount} sesi dinilai provider.`
          : 'Belum ada sesi speaking yang dinilai provider.',
    },
    {
      dimension: 'Kelancaran',
      status: fluencyTotal > 0 ? 'measured' : 'insufficient',
      detail: fluencyTotal > 0 ? `${fluencyTotal} sesi punya skor fluency.` : 'Butuh sesi speaking yang sudah dinilai.',
    },
    {
      dimension: 'Pelafalan',
      status: 'insufficient',
      detail: 'Butuh audio asli dan provider phoneme-capable.',
    },
    {
      dimension: 'Intonasi',
      status: 'insufficient',
      detail: 'Butuh audio asli; transkrip teks tidak cukup.',
    },
  ]

  const attentionItems = attention.slice(0, 5).map((item) => ({
    ...item,
    name: names.get(item.studentId) ?? 'Siswa',
  }))

  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[10px] uppercase tracking-[0.12em] underline underline-offset-4"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-rule px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Analitik Mendalam{today ? ` · ${today}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <PeriodSwitch value={period} onChange={onPeriodChange} />
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 bg-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3 w-3" aria-hidden />
                {downloading ? 'Menyiapkan' : 'Unduh PDF'}
              </button>
            </div>
          </div>

          <h1 className="mt-4 max-w-[52ch] text-balance font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
            {loading ? 'Membaca data kelas…' : insight}
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            Rentang {PERIOD_LABEL[period]} &middot; ambang perhatian 60 &middot; target {TARGET}
          </p>
        </div>

        <ReadoutStrip items={readouts} />

        {loading ? (
          <div className="border-t border-rule px-5 py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Memuat panel
          </div>
        ) : !analytics ? (
          <div className="border-t border-rule px-5 py-10">
            <EmptyNote
              title="Data analitik belum tersedia"
              description="Permintaan ke server tidak mengembalikan data. Coba muat ulang; tidak ada angka yang ditampilkan agar tidak menyesatkan."
              action={
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                >
                  Muat ulang
                </button>
              }
            />
          </div>
        ) : analytics.summary.classroomCount === 0 ? (
          <div className="border-t border-rule px-5 py-10">
            <EmptyNote
              title="Belum ada kelas"
              description="Buat kelas, undang siswa, lalu tugaskan latihan speaking. Seluruh panel di halaman ini terisi otomatis dari data nyata."
              action={
                <Link
                  href="/guru/kelas"
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                >
                  Buat kelas <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
          </div>
        ) : !hasActivity ? (
          <div className="grid grid-cols-1 gap-px border-t border-rule bg-rule lg:grid-cols-3">
            <Panel label="Kurva Akurasi" meta="0 attempt" className="lg:col-span-2">
              <AccuracyCurve points={[]} target={TARGET} />
            </Panel>

            <Panel label="Cakupan Bukti" meta={`0/${evidenceRows.length}`}>
              <EvidenceCoverage rows={evidenceRows} />
            </Panel>

            <Panel label="Sebaran Kelas" meta={`${analytics.classrooms.length} kelas`}>
              <ClassroomSpread items={analytics.classrooms} />
            </Panel>

            <Panel label="Langkah Berikutnya" className="lg:col-span-2">
              <NextSteps />
            </Panel>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px border-t border-rule bg-rule lg:grid-cols-3">
            <Panel label="Kurva Akurasi" meta={`${attempts} attempt`} className="lg:col-span-2">
              <AccuracyCurve points={analytics.trend} target={TARGET} />
            </Panel>

            <Panel label="Peta Kemampuan" meta="terlemah dulu">
              {analytics.skills.length ? (
                <SkillLedger items={analytics.skills.slice(0, 6)} target={TARGET} />
              ) : (
                <EmptyNote
                  title="Belum ada data skill"
                  description="Peta terisi setelah siswa menjawab soal pada latihan kuis."
                />
              )}
            </Panel>

            <Panel label="Kesalahan Paling Sering" meta={`${analytics.commonErrors.length} tipe`}>
              <div className="flex h-full flex-col justify-between">
                {analytics.commonErrors.length ? (
                  <ErrorRanking items={analytics.commonErrors.slice(0, 5)} />
                ) : (
                  <EmptyNote
                    title="Belum ada error terdeteksi"
                    description="Tipe kesalahan muncul dari jawaban yang salah pada latihan."
                  />
                )}
                <p className="mt-4 border-t border-rule pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
                  {totalErrors} error dari {attempts} attempt
                </p>
              </div>
            </Panel>

            <Panel label="Distribusi Kelancaran" meta="fluency">
              {fluencyTotal > 0 ? (
                <FluencyHistogram buckets={analytics.fluencyDistribution} />
              ) : (
                <EmptyNote
                  title="Belum ada skor fluency"
                  description="Butuh sesi speaking yang sudah dinilai provider."
                />
              )}
            </Panel>

            <Panel
              label="Cakupan Bukti"
              meta={`${evidenceRows.filter((row) => row.status === 'measured').length}/${evidenceRows.length}`}
            >
              <EvidenceCoverage rows={evidenceRows} />
            </Panel>

            <Panel label="Perlu Perhatian" meta={`${attention.length} siswa`}>
              {attention.length ? (
                <AttentionList items={attentionItems} />
              ) : (
                <EmptyNote
                  title="Tidak ada siswa berisiko"
                  description="Siswa muncul di sini bila akurasi latihan atau skor speaking di bawah 60."
                />
              )}
            </Panel>

            <Panel
              label="Sebaran Kelas"
              className="lg:col-span-2"
              action={
                <Link
                  href="/guru/kelas"
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                >
                  Kelola <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            >
              <ClassroomSpread items={analytics.classrooms} />
            </Panel>
          </div>
        )}
      </div>

      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50">
        Sumber: Firestore &middot; attempt latihan, assessment speaking, keanggotaan kelas
      </p>
    </div>
  )
}
