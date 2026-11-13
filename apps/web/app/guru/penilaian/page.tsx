'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useClassroomOverview } from '@/components/guru/use-classroom-overview'
import type { TeacherReviewQueueItem } from '@/lib/submissions'

function formatDue(value: string | null) {
  if (!value) return 'Tanpa tenggat'
  return `Tenggat ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))}`
}

export default function SubmissionListPage() {
  const { classrooms, loading, error, reload } = useClassroomOverview()
  const [pendingByAssignment, setPendingByAssignment] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    let cancelled = false
    void fetch('/api/submissions/review-queue', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return
        const counts = new Map<string, number>()
        for (const item of payload.data as TeacherReviewQueueItem[]) {
          counts.set(item.assignment.id, (counts.get(item.assignment.id) ?? 0) + 1)
        }
        setPendingByAssignment(counts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const totalPending = Array.from(pendingByAssignment.values()).reduce((total, count) => total + count, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Submission</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tinjau pekerjaan siswa per penugasan dan beri keputusan review.
          </p>
        </div>
        {totalPending > 0 && (
          <Badge className="h-6 gap-1.5 bg-brand/20 px-2.5 text-xs font-semibold text-brand-foreground">
            {totalPending} menunggu review
          </Badge>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Coba lagi
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <ClipboardList className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <h2 className="font-heading text-lg font-bold text-foreground">Belum ada kelas</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Buat kelas dan penugasan terlebih dahulu untuk mulai meninjau submission.
          </p>
          <Button asChild className="mt-5">
            <Link href="/guru/kelas">Buka daftar kelas</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {classrooms.map((classroom) => (
            <section key={classroom.id} aria-labelledby={`class-${classroom.id}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 id={`class-${classroom.id}`} className="font-heading text-base font-bold text-foreground">
                  {classroom.name}
                </h2>
                <Link
                  href={`/guru/kelas/${classroom.id}?tab=classwork`}
                  className="text-xs font-semibold text-primary-deep hover:underline"
                >
                  Buka kelas
                </Link>
              </div>

              {classroom.assignments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada penugasan di kelas ini.
                </p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {classroom.assignments.map((assignment) => {
                    const pending = pendingByAssignment.get(assignment.id) ?? 0
                    return (
                      <li key={assignment.id}>
                        <Link
                          href={`/guru/penilaian/${assignment.id}`}
                          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/60"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-deep">
                            <ClipboardList className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{assignment.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDue(assignment.dueAt)} · {classroom.members.length} siswa
                            </p>
                          </div>
                          {pending > 0 ? (
                            <Badge className="bg-brand/20 text-brand-foreground">{pending} perlu dinilai</Badge>
                          ) : (
                            <Badge variant="secondary">Selesai</Badge>
                          )}
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
