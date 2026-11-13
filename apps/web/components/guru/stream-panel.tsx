'use client'

import Link from 'next/link'
import type { Assignment, Classroom } from '@tuturai/domain'
import { CalendarClock, ClipboardList, FileText, Plus } from 'lucide-react'
import { classInitials } from '@/lib/class-tint'
import { Button } from '@/components/ui/button'

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function StreamPanel({
  classroom,
  assignments,
  band,
  teacherName,
  onCompose,
}: {
  classroom: Classroom
  assignments: Assignment[]
  band: string
  teacherName: string
  onCompose: () => void
}) {
  const published = assignments.filter((assignment) => assignment.status === 'published')
  const upcoming = published
    .filter((assignment) => assignment.dueAt !== null)
    .sort((left, right) => Date.parse(left.dueAt ?? '') - Date.parse(right.dueAt ?? ''))
    .slice(0, 4)

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-heading text-sm font-bold text-foreground">Tenggat terdekat</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Tidak ada tenggat terdekat.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {upcoming.map((assignment) => (
                <li key={assignment.id}>
                  <Link
                    href={`/guru/penilaian/${assignment.id}`}
                    className="block text-xs font-medium text-foreground hover:text-primary-deep"
                  >
                    {assignment.title}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    {formatDateTime(assignment.dueAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button variant="outline" onClick={onCompose} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          Buat penugasan
        </Button>
      </aside>

      <section aria-label="Aktivitas kelas" className="space-y-3">
        {published.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-base font-bold text-foreground">Belum ada penugasan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Penugasan yang dipublish akan muncul di stream kelas ini.
            </p>
            <Button onClick={onCompose} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Buat penugasan
            </Button>
          </div>
        ) : (
          published.map((assignment) => (
            <article key={assignment.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: band }}
                >
                  {classInitials(classroom.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{assignment.title}</h3>
                    <p className="text-xs text-muted-foreground">{formatDate(assignment.createdAt)}</p>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {assignment.instructions}
                  </p>
                  {assignment.attachments?.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {assignment.attachments.map((file) => (
                        <li key={file.id}>
                          <a
                            href={file.webViewLink ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <Link
                      href={`/guru/penilaian/${assignment.id}`}
                      className="font-semibold text-primary-deep hover:underline"
                    >
                      Lihat submission
                    </Link>
                    <span className="text-muted-foreground">
                      {assignment.dueAt ? `Tenggat ${formatDateTime(assignment.dueAt)}` : 'Tanpa tenggat'}
                    </span>
                    <span className="text-muted-foreground">{assignment.maxAttempts} attempt</span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
