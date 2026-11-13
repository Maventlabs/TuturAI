'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Assignment } from '@tuturai/domain'
import type { AssignmentStudentRow } from '@/lib/submissions'
import { submissionStatusMeta, submissionToneClass } from '@/lib/submission-status'
import { classInitials } from '@/lib/class-tint'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ClassroomMemberSummary } from '@/components/guru/use-classroom-overview'

type ApiResponse<T> = { data: T; error?: { message?: string } }

function scoreTone(score: number) {
  if (score >= 80) return 'bg-success/10 text-success'
  if (score >= 60) return 'bg-warning/10 text-warning'
  return 'bg-destructive/10 text-destructive'
}

export function GradesPanel({
  assignments,
  members,
}: {
  assignments: Assignment[]
  members: ClassroomMemberSummary[]
}) {
  const [rows, setRows] = useState<Record<string, AssignmentStudentRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const published = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'published'),
    [assignments],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const results = await Promise.all(
          published.map(async (assignment) => {
            const response = await fetch(`/api/assignments/${assignment.id}/submissions`, {
              cache: 'no-store',
              signal: controller.signal,
            })
            const payload = await response.json() as ApiResponse<{ students: AssignmentStudentRow[] }>
            if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat nilai')
            return [assignment.id, payload.data.students] as const
          }),
        )
        if (!controller.signal.aborted) {
          setRows(Object.fromEntries(results))
          setError(null)
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Gagal memuat nilai')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [published])

  function rowFor(assignmentId: string, studentId: string) {
    return rows[assignmentId]?.find((row) => row.studentId === studentId) ?? null
  }

  const averages = members.map((member) => {
    const scores = published
      .map((assignment) => rowFor(assignment.id, member.studentId)?.assessment?.overall)
      .filter((score): score is number => typeof score === 'number')
    return scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null
  })

  const scored = averages.filter((value): value is number => typeof value === 'number')
  const classAverage = scored.length > 0 ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null

  if (published.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <h2 className="font-heading text-base font-bold text-foreground">Belum ada nilai</h2>
        <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
          Publish penugasan terlebih dahulu. Setelah siswa mengumpulkan, nilai akan muncul di sini.
        </p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <h2 className="font-heading text-base font-bold text-foreground">Belum ada siswa</h2>
        <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
          Bagikan kode join kelas agar siswa dapat bergabung dan nilai bisa direkap.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Grades</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rekap nilai per penugasan. Klik judul kolom untuk membuka submission.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-heading text-xl font-bold tabular-nums text-foreground">{classAverage ?? '—'}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rata-rata kelas</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-bold tabular-nums text-foreground">{scored.length}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Siswa ternilai</p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-56 bg-card pl-4">Siswa</TableHead>
              {published.map((assignment) => (
                <TableHead key={assignment.id} className="min-w-32 text-center">
                  <Link
                    href={`/guru/penilaian/${assignment.id}`}
                    className="block max-w-32 truncate text-xs font-semibold text-foreground hover:text-primary-deep"
                    title={assignment.title}
                  >
                    {assignment.title}
                  </Link>
                  <span className="block text-[10px] font-normal text-muted-foreground">maks 100</span>
                </TableHead>
              ))}
              <TableHead className="min-w-24 pr-4 text-right">Rata-rata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.studentId}>
                <TableCell className="sticky left-0 z-10 bg-card pl-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground"
                    >
                      {classInitials(member.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{member.name}</span>
                      {member.email && (
                        <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </span>
                  </div>
                </TableCell>

                {published.map((assignment) => {
                  const row = rowFor(assignment.id, member.studentId)
                  const score = row?.assessment?.overall
                  const meta = submissionStatusMeta(row?.submission?.status ?? null)
                  return (
                    <TableCell key={assignment.id} className="text-center">
                      {typeof score === 'number' ? (
                        <span
                          className={cn(
                            'inline-flex min-w-10 justify-center rounded-md px-2 py-1 font-mono text-sm font-semibold tabular-nums',
                            scoreTone(score),
                          )}
                        >
                          {score}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            submissionToneClass[meta.tone],
                          )}
                        >
                          {meta.label}
                        </span>
                      )}
                    </TableCell>
                  )
                })}

                <TableCell className="pr-4 text-right">
                  <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {averages[index] ?? '—'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          Memuat nilai...
        </p>
      )}
    </div>
  )
}
