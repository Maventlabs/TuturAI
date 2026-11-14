'use client'

import Link from 'next/link'
import type { Assignment, Classroom } from '@tuturai/domain'
import { ArrowRight, CalendarClock, ClipboardList, FileText, Plus, Repeat2 } from 'lucide-react'
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
  composeHref,
  classworkHref,
}: {
  classroom: Classroom
  assignments: Assignment[]
  band: string
  composeHref: string
  classworkHref: string
}) {
  const published = assignments.filter((assignment) => assignment.status === 'published')
  const upcoming = published
    .filter((assignment) => assignment.dueAt !== null)
    .sort((left, right) => Date.parse(left.dueAt ?? '') - Date.parse(right.dueAt ?? ''))
    .slice(0, 4)

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[264px_1fr]">
      <aside className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-heading text-sm font-bold text-foreground">Tenggat terdekat</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-5 text-xs leading-relaxed text-muted-foreground">
              Belum ada tenggat. Penugasan yang dipublish akan muncul di sini.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((assignment) => (
                <li key={assignment.id}>
                  <Link
                    href={`/guru/penilaian/${assignment.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-secondary/50"
                  >
                    <span className="block truncate text-xs font-semibold text-foreground">{assignment.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      {formatDateTime(assignment.dueAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={classworkHref}
            className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs font-semibold text-primary-deep transition-colors hover:bg-secondary/50"
          >
            Lihat semua
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href={composeHref}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat penugasan
          </Link>
        </Button>
      </aside>

      <section aria-label="Aktivitas kelas" className="space-y-3">
        {published.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-base font-bold text-foreground">Belum ada penugasan</h2>
            <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
              Penugasan yang dipublish akan muncul di stream kelas ini.
            </p>
            <Button asChild className="mt-4 gap-2">
              <Link href={composeHref}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Buat penugasan
              </Link>
            </Button>
          </div>
        ) : (
          published.map((assignment) => (
            <article key={assignment.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 px-4 pt-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: band }}
                >
                  {classInitials(classroom.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{assignment.title}</h3>
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {formatDate(assignment.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {assignment.instructions}
                  </p>
                </div>
              </div>

              {assignment.attachments?.length ? (
                <ul className="mt-3 flex flex-wrap gap-2 px-4">
                  {assignment.attachments.map((file) => (
                    <li key={file.id}>
                      <a
                        href={file.webViewLink ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-[11px]">
                <Link
                  href={`/guru/penilaian/${assignment.id}`}
                  className="font-semibold text-primary-deep hover:underline"
                >
                  Lihat submission
                </Link>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {assignment.dueAt ? formatDateTime(assignment.dueAt) : 'Tanpa tenggat'}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Repeat2 className="h-3 w-3" aria-hidden="true" />
                  {assignment.maxAttempts} attempt
                </span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
