'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ClipboardList, Users } from 'lucide-react'
import type { Assignment } from '@tuturai/domain'
import type { AssignmentStudentRow } from '@/lib/submissions'
import { submissionStatusMeta, submissionToneClass } from '@/lib/submission-status'
import { classInitials } from '@/lib/class-tint'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type AssignmentSubmissionsPayload = {
  assignment: Assignment
  classId: string
  className: string
  students: AssignmentStudentRow[]
}

type ApiResponse<T> = { data: T; error?: { message?: string } }

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function StudentWorkTable({ assignmentId }: { assignmentId: string }) {
  const [payload, setPayload] = useState<AssignmentSubmissionsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/assignments/${assignmentId}/submissions`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = await response.json() as ApiResponse<AssignmentSubmissionsPayload>
        if (!response.ok) throw new Error(body.error?.message ?? 'Gagal memuat submission')
        if (!controller.signal.aborted) setPayload(body.data)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat submission')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [assignmentId])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
        <div className="h-5 w-56 animate-pulse rounded bg-secondary" />
        <div className="h-24 animate-pulse rounded-xl bg-secondary" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="mx-auto max-w-5xl">
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error ?? 'Penugasan tidak ditemukan'}</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/guru/penilaian">Kembali ke submission</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { assignment, className, students } = payload
  const submitted = students.filter((student) => student.submission !== null)
  const pending = students.filter((student) => {
    const status = student.submission?.status ?? null
    return status === 'submitted' || status === 'pending_review'
  })
  const missing = students.length - submitted.length

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link href="/guru/penilaian" className="font-medium text-primary-deep hover:underline">
          Submission
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-muted-foreground">{className}</span>
      </nav>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-deep">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-xl font-bold text-foreground">{assignment.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {className} · {assignment.dueAt ? `Tenggat ${formatDateTime(assignment.dueAt)}` : 'Tanpa tenggat'} ·{' '}
              {assignment.maxAttempts} attempt
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-secondary px-3 py-1 font-semibold text-foreground">
            {submitted.length} dikumpulkan
          </span>
          <span className="rounded-full bg-brand/20 px-3 py-1 font-semibold text-brand-foreground">
            {pending.length} perlu dinilai
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 font-semibold text-muted-foreground">
            {missing} belum mengumpulkan
          </span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-heading text-base font-bold text-foreground">Belum ada siswa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bagikan kode join kelas agar siswa dapat bergabung dan mengumpulkan tugas.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Siswa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Dikumpulkan</TableHead>
                <TableHead className="text-right">Skor AI</TableHead>
                <TableHead className="w-10 pr-4">
                  <span className="sr-only">Buka</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const meta = submissionStatusMeta(student.submission?.status ?? null)
                return (
                  <TableRow key={student.studentId}>
                    <TableCell className="pl-4">
                      <Link
                        href={`/guru/penilaian/${assignmentId}/${student.studentId}`}
                        className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                          {classInitials(student.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{student.name}</span>
                          {student.email && (
                            <span className="block truncate text-xs text-muted-foreground">{student.email}</span>
                          )}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', submissionToneClass[meta.tone])}>
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatDateTime(student.submission?.submittedAt ?? null)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {typeof student.assessment?.overall === 'number' ? student.assessment.overall : '—'}
                    </TableCell>
                    <TableCell className="pr-4">
                      <Link
                        href={`/guru/penilaian/${assignmentId}/${student.studentId}`}
                        aria-label={`Tinjau submission ${student.name}`}
                        className="flex justify-end text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
