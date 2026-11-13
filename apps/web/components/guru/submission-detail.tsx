'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ClipboardList, FileText, RotateCcw } from 'lucide-react'
import type { Assignment } from '@tuturai/domain'
import type { AssignmentStudentRow } from '@/lib/submissions'
import { submissionStatusMeta, submissionToneClass } from '@/lib/submission-status'
import { classInitials } from '@/lib/class-tint'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type AssignmentSubmissionsPayload = {
  assignment: Assignment
  classId: string
  className: string
  students: AssignmentStudentRow[]
}

type ApiResponse<T> = { data: T; error?: { message?: string } }

const DIMENSIONS = ['pronunciation', 'fluency', 'intonation', 'grammar', 'vocabulary'] as const

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function SubmissionDetail({
  assignmentId,
  studentId,
}: {
  assignmentId: string
  studentId: string
}) {
  const [payload, setPayload] = useState<AssignmentSubmissionsPayload | null>(null)
  const [row, setRow] = useState<AssignmentStudentRow | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'approve' | 'return' | null>(null)

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

        const found = body.data.students.find((student) => student.studentId === studentId) ?? null
        if (!found) throw new Error('Siswa tidak ditemukan di kelas ini')

        if (!controller.signal.aborted) {
          setPayload(body.data)
          setRow(found)
          setFeedback(found.submission?.teacherFeedback ?? '')
        }
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
  }, [assignmentId, studentId])

  async function review(action: 'approve' | 'return') {
    if (!row?.submission) return
    if (action === 'return' && !feedback.trim()) {
      setActionError('Umpan balik wajib diisi sebelum submission dikembalikan')
      return
    }
    setBusy(action)
    setActionError(null)
    try {
      const response = await fetch(`/api/submissions/${row.submission.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? 'Gagal menyimpan review')
      setRow((current) => (current ? { ...current, submission: body.data } : current))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Gagal menyimpan review')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
        <div className="h-5 w-56 animate-pulse rounded bg-secondary" />
        <div className="h-28 animate-pulse rounded-xl bg-secondary" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
      </div>
    )
  }

  if (error || !payload || !row) {
    return (
      <div className="mx-auto max-w-5xl">
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error ?? 'Submission tidak ditemukan'}</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={`/guru/penilaian/${assignmentId}`}>Kembali ke daftar siswa</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { assignment, className } = payload
  const submission = row.submission
  const assessment = row.assessment
  const meta = submissionStatusMeta(submission?.status ?? null)
  const reviewable = submission !== null && (submission.status === 'submitted' || submission.status === 'pending_review')

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link href="/guru/penilaian" className="font-medium text-primary-deep hover:underline">
          Submission
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <Link href={`/guru/penilaian/${assignmentId}`} className="truncate text-muted-foreground hover:underline">
          {className}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-muted-foreground">{row.name}</span>
      </nav>

      <div className="flex items-start gap-3 border-b border-border pb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-deep">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-bold text-foreground sm:text-2xl">{assignment.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {className} · {assignment.dueAt ? `Tenggat ${formatDateTime(assignment.dueAt)}` : 'Tanpa tenggat'}
          </p>
          <p className="text-sm text-muted-foreground">
            {submission ? `Attempt ${submission.attempt} dari ${assignment.maxAttempts}` : `${assignment.maxAttempts} attempt`}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section aria-labelledby="instructions-heading" className="rounded-xl border border-border bg-card p-5">
            <h2 id="instructions-heading" className="font-heading text-base font-bold text-foreground">
              Instruksi
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {assignment.instructions}
            </p>
            {assignment.attachments?.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {assignment.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.webViewLink ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {submission?.files?.length ? (
            <section aria-labelledby="files-heading" className="rounded-xl border border-border bg-card p-5">
              <h2 id="files-heading" className="font-heading text-base font-bold text-foreground">
                Berkas siswa
              </h2>
              <ul className="mt-3 space-y-2">
                {submission.files.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.webViewLink ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-deep hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="assessment-heading" className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="assessment-heading" className="font-heading text-base font-bold text-foreground">
                Hasil AI speaking
              </h2>
              {typeof assessment?.overall === 'number' && (
                <span className="font-mono text-lg font-bold text-primary-deep">{assessment.overall}/100</span>
              )}
            </div>

            {assessment ? (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {DIMENSIONS.map((dimension) => (
                    <div key={dimension} className="rounded-lg border border-border bg-secondary/40 px-2.5 py-2">
                      <dt className="text-[11px] capitalize text-muted-foreground">{dimension}</dt>
                      <dd className="font-mono text-sm font-semibold text-foreground">{assessment[dimension]}</dd>
                    </div>
                  ))}
                </dl>
                {assessment.feedback && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{assessment.feedback}</p>
                )}
                {assessment.transcript && (
                  <div className="mt-3 rounded-lg bg-secondary/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transkrip</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{assessment.transcript}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                Belum ada hasil AI untuk submission ini. Review tetap dapat dilakukan berdasarkan pekerjaan siswa.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="status-heading" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="status-heading" className="font-heading text-sm font-bold text-foreground">
                Status pengumpulan
              </h2>
              <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', submissionToneClass[meta.tone])}>
                {meta.label}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                {classInitials(row.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                {row.email && <p className="truncate text-xs text-muted-foreground">{row.email}</p>}
              </div>
            </div>

            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Dikumpulkan</dt>
                <dd className="font-medium text-foreground">{formatDateTime(submission?.submittedAt ?? null)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Ketepatan waktu</dt>
                <dd className="font-medium text-foreground">
                  {submission ? (submission.isLate ? 'Terlambat' : 'Tepat waktu') : '—'}
                </dd>
              </div>
            </dl>

            {!submission && (
              <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Siswa belum mengumpulkan pekerjaan untuk penugasan ini.
              </p>
            )}
          </section>

          <section aria-labelledby="feedback-heading" className="rounded-xl border border-border bg-card p-4">
            <h2 id="feedback-heading" className="font-heading text-sm font-bold text-foreground">
              Umpan balik guru
            </h2>
            <label htmlFor="teacher-feedback" className="sr-only">
              Umpan balik untuk {row.name}
            </label>
            <Textarea
              id="teacher-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tulis umpan balik untuk siswa..."
              disabled={!submission}
              className="mt-2 min-h-28 resize-none"
            />

            {actionError && (
              <p role="alert" className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {actionError}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2">
              <Button
                onClick={() => void review('approve')}
                disabled={!reviewable || busy !== null}
                className="w-full gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy === 'approve' ? 'Menyetujui...' : 'Setujui'}
              </Button>
              <Button
                variant="outline"
                onClick={() => void review('return')}
                disabled={!reviewable || busy !== null}
                className="w-full gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                {busy === 'return' ? 'Mengembalikan...' : 'Kembalikan'}
              </Button>
            </div>

            {!reviewable && submission && (
              <p className="mt-2 text-xs text-muted-foreground">
                Submission ini sudah direview. Siswa perlu mengumpulkan ulang untuk review berikutnya.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
