import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { GradebookColumn, GradebookRow } from '@/lib/gradebook'

function scoreTint(score: number | null) {
  if (score === null) return ''
  if (score >= 85) return 'bg-primary/15'
  if (score >= 75) return 'bg-primary/8'
  if (score >= 60) return 'bg-warning/10'
  return 'bg-warning/20'
}

function scoreInk(score: number | null) {
  if (score === null) return 'text-muted-foreground/35'
  if (score < 60) return 'text-warning'
  return 'text-foreground'
}

function formatScore(score: number | null) {
  if (score === null) return '–'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function rowStatus(row: GradebookRow) {
  if (row.pendingCount > 0) return { label: `${row.pendingCount} menunggu`, tone: 'text-warning' }
  if (row.missingCount > 0) return { label: `${row.missingCount} kosong`, tone: 'text-muted-foreground' }
  return { label: 'Lengkap', tone: 'text-muted-foreground/75' }
}

interface ScoreMatrixProps {
  columns: GradebookColumn[]
  rows: GradebookRow[]
  loading?: boolean
}

export function ScoreMatrix({ columns, rows, loading = false }: ScoreMatrixProps) {
  if (loading) {
    return (
      <div className="divide-y divide-rule" aria-busy="true" aria-label="Memuat matriks nilai">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            <div className="h-2.5 w-4 animate-pulse bg-secondary" />
            <div className="h-2.5 flex-1 animate-pulse bg-secondary" />
            <div className="h-2.5 w-10 animate-pulse bg-secondary" />
            <div className="h-2.5 w-10 animate-pulse bg-secondary" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">
          Matriks nilai speaking per siswa dan per penugasan, diurutkan dari rata-rata tertinggi.
        </caption>
        <thead>
          <tr className="border-b border-rule">
            <th
              scope="col"
              className="sticky left-0 z-20 w-[240px] min-w-[200px] bg-card px-4 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
            >
              Siswa
            </th>
            {columns.map((column) => (
              <th
                key={column.assignmentId}
                scope="col"
                className="w-[68px] border-l border-rule/60 px-1 py-2.5 text-center align-bottom"
              >
                <Link
                  href={`/guru/penilaian/${column.assignmentId}`}
                  title={column.title}
                  className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary"
                >
                  {column.short}
                </Link>
              </th>
            ))}
            <th
              scope="col"
              className="w-[92px] border-l border-rule px-3 py-2.5 text-right font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-foreground"
            >
              Rata
            </th>
            <th
              scope="col"
              className="w-[104px] px-3 py-2.5 text-right font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const status = rowStatus(row)
            return (
              <tr key={row.studentId} className="group border-b border-rule/60 last:border-b-0">
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal">
                  <span className="absolute inset-y-0 left-0 w-[2px] bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="flex items-baseline gap-2.5">
                    <span className="w-4 shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/45">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-[12.5px] leading-tight text-foreground">{row.name}</span>
                  </span>
                </th>
                {row.cells.map((cell) => (
                  <td
                    key={cell.assignmentId}
                    className={cn(
                      'border-l border-rule/60 px-1 py-2 text-center font-mono text-[12px] tabular-nums',
                      scoreTint(cell.score),
                      scoreInk(cell.score),
                    )}
                  >
                    {cell.status === 'pending' && cell.score === null ? (
                      <span className="text-[9px] uppercase tracking-[0.1em] text-warning/80">tinjau</span>
                    ) : (
                      formatScore(cell.score)
                    )}
                  </td>
                ))}
                <td className="border-l border-rule px-3 py-2 text-right">
                  <span className="font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                    {row.average === null ? '–' : row.average.toFixed(1)}
                  </span>
                  <span className="mt-1 ml-auto block h-[2px] w-12 bg-secondary" aria-hidden>
                    <span
                      className={cn('block h-full', row.average !== null && row.average < 75 ? 'bg-warning' : 'bg-primary')}
                      style={{ width: `${Math.min(100, row.average ?? 0)}%` }}
                    />
                  </span>
                </td>
                <td className={cn('px-3 py-2 text-right font-mono text-[9px] uppercase tracking-[0.1em]', status.tone)}>
                  {status.label}
                </td>
              </tr>
            )
          })}
        </tbody>
        {columns.length > 0 && (
          <tfoot>
            <tr className="border-t border-rule bg-secondary/40">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-secondary px-4 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Rata-rata penugasan
              </th>
              {columns.map((column) => (
                <td
                  key={column.assignmentId}
                  className="border-l border-rule/60 px-1 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground/80"
                >
                  {column.average === null ? '–' : column.average.toFixed(1)}
                </td>
              ))}
              <td className="border-l border-rule px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
                {columns.reduce((total, column) => total + column.gradedCount, 0)} nilai
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
