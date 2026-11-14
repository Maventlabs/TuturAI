'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyNote, Panel } from '@/components/guru/overview/panel'
import { ReadoutStrip, type Readout } from '@/components/guru/overview/readout-strip'
import { ClassTabs } from '@/components/guru/gradebook/class-tabs'
import { ScoreMatrix } from '@/components/guru/gradebook/score-matrix'
import { ScoreDistribution } from '@/components/guru/gradebook/score-distribution'
import { DimensionRadar } from '@/components/guru/gradebook/dimension-radar'
import { TARGET_SCORE, type Gradebook } from '@/lib/gradebook'

const SCALE_LEGEND = [
  { label: '<60', swatch: 'bg-warning/20' },
  { label: '60-74', swatch: 'bg-warning/10' },
  { label: '75-84', swatch: 'bg-primary/8' },
  { label: '85+', swatch: 'bg-primary/15' },
]

export interface GradebookViewProps {
  className: string | null
  gradebook: Gradebook
  loading: boolean
  error: string | null
  classrooms: Array<{ id: string; name: string; studentCount: number }>
  activeClassId: string | null
  onSelectClass: (id: string) => void
  onRetry: () => void
}

export function GradebookView({
  className,
  gradebook,
  loading,
  error,
  classrooms,
  activeClassId,
  onSelectClass,
  onRetry,
}: GradebookViewProps) {
  const readouts: Readout[] = [
    {
      label: 'Rata-rata kelas',
      value: gradebook.classAverage === null ? '–' : gradebook.classAverage.toFixed(1),
      note: `target ${TARGET_SCORE}`,
    },
    {
      label: 'Nilai masuk',
      value: String(gradebook.gradedTotal),
      unit: `/ ${gradebook.possibleTotal}`,
      note: `${gradebook.columns.length} penugasan`,
    },
    {
      label: 'Menunggu review',
      value: String(gradebook.pendingTotal),
      tone: gradebook.pendingTotal > 0 ? 'attention' : 'default',
      note: gradebook.pendingTotal > 0 ? 'perlu keputusan' : 'antrean bersih',
    },
    {
      label: 'Di bawah target',
      value: String(gradebook.belowTarget),
      unit: 'siswa',
      tone: gradebook.belowTarget > 0 ? 'attention' : 'default',
      note: `rata-rata < ${TARGET_SCORE}`,
    },
    {
      label: 'Nilai tertinggi',
      value: gradebook.highest === null ? '–' : String(gradebook.highest),
      note: 'sesi terbaik',
    },
  ]

  const insight = (() => {
    if (!className) return ''
    if (gradebook.columns.length === 0) {
      return `${gradebook.rows.length} siswa terdaftar, belum ada penugasan. Buat penugasan untuk mulai mengisi buku nilai.`
    }
    if (gradebook.gradedTotal === 0) {
      return `${gradebook.rows.length} siswa terdaftar pada ${gradebook.columns.length} penugasan, belum ada nilai speaking yang masuk.`
    }
    const base = `Rata-rata kelas ${gradebook.classAverage?.toFixed(1)} dari ${gradebook.gradedTotal} nilai pada ${gradebook.columns.length} penugasan.`
    if (gradebook.belowTarget > 0) {
      return `${base} ${gradebook.belowTarget} siswa masih di bawah target ${TARGET_SCORE}.`
    }
    return `${base} Seluruh siswa sudah melewati target ${TARGET_SCORE}.`
  })()

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Buku Nilai · Speaking
        </p>
        <h1 className="mt-1.5 font-heading text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {className ?? 'Daftar nilai'}
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-muted-foreground">{insight}</p>
        {classrooms.length > 1 && (
          <div className="mt-4">
            <ClassTabs classrooms={classrooms} activeId={activeClassId} onSelect={onSelectClass} />
          </div>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive"
        >
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-px bg-rule" aria-busy="true">
          <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-[92px] animate-pulse bg-card" />
            ))}
          </div>
          <div className="h-[220px] animate-pulse bg-card" />
        </div>
      ) : classrooms.length === 0 ? (
        <section className="border border-rule bg-card px-6 py-14">
          <div className="mx-auto max-w-sm">
            <EmptyNote
              title="Belum ada kelas"
              description="Buku nilai dibangun dari kelas aktif. Buat kelas dan penugasan terlebih dahulu, lalu nilai akan tersusun otomatis per siswa."
              action={
                <Button asChild size="sm">
                  <Link href="/guru/kelas">Buka daftar kelas</Link>
                </Button>
              }
            />
          </div>
        </section>
      ) : (
        <>
          <ReadoutStrip items={readouts} />

          <div className="grid gap-px bg-rule lg:grid-cols-2">
            <Panel label="Distribusi Nilai" meta={`n = ${gradebook.gradedTotal}`}>
              {gradebook.gradedTotal === 0 ? (
                <EmptyNote
                  title="Belum ada nilai"
                  description="Distribusi terbentuk setelah minimal satu sesi speaking selesai dinilai."
                />
              ) : (
                <ScoreDistribution
                  distribution={gradebook.distribution}
                  classAverage={gradebook.classAverage}
                  gradedTotal={gradebook.gradedTotal}
                />
              )}
            </Panel>

            <Panel label="Profil Dimensi" meta={`target ${TARGET_SCORE}`}>
              {gradebook.dimensions.every((dimension) => dimension.value === null) ? (
                <EmptyNote
                  title="Dimensi belum terukur"
                  description="Pronunciation dan intonation hanya terisi bila audio asli tersedia. Dimensi tanpa bukti ditandai n/a, bukan diberi nilai perkiraan."
                />
              ) : (
                <DimensionRadar dimensions={gradebook.dimensions} />
              )}
            </Panel>
          </div>

          <section className="bg-card">
            <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Matriks Nilai
              </h2>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                {gradebook.rows.length} siswa · {gradebook.columns.length} penugasan
              </span>
            </header>

            {gradebook.rows.length === 0 ? (
              <div className="px-4 py-6">
                <EmptyNote
                  title="Belum ada siswa"
                  description="Bagikan kode kelas agar siswa bergabung. Baris nilai akan muncul otomatis di sini."
                />
              </div>
            ) : (
              <ScoreMatrix columns={gradebook.columns} rows={gradebook.rows} />
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-4 py-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">Skala</span>
              {SCALE_LEGEND.map((entry) => (
                <span key={entry.label} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-4 ${entry.swatch}`} aria-hidden />
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{entry.label}</span>
                </span>
              ))}
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">
                Klik kode A1, A2, … untuk membuka penugasan
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
