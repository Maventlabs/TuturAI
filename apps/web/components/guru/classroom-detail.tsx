'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Assignment, Classroom } from '@tuturai/domain'
import { ChevronRight, ClipboardList, FileText, Plus, UserMinus, Users } from 'lucide-react'
import { classBandColor, classInitials } from '@/lib/class-tint'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTeacherName, type ClassroomMemberSummary } from '@/components/guru/use-classroom-overview'

type Tab = 'stream' | 'classwork' | 'people'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stream', label: 'Stream' },
  { id: 'classwork', label: 'Classwork' },
  { id: 'people', label: 'People' },
]

type ApiResponse<T> = { data: T; error?: { message?: string } }

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ClassroomDetail({
  classroomId,
  initialTab,
}: {
  classroomId: string
  initialTab: Tab
}) {
  const teacherName = useTeacherName()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [members, setMembers] = useState<ClassroomMemberSummary[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [upcoming, setUpcoming] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [classroomsResponse, membersResponse, assignmentsResponse] = await Promise.all([
          fetch('/api/classrooms', { cache: 'no-store', signal: controller.signal }),
          fetch(`/api/classrooms/${classroomId}/members`, { cache: 'no-store', signal: controller.signal }),
          fetch(`/api/classrooms/${classroomId}/assignments`, { cache: 'no-store', signal: controller.signal }),
        ])

        const classroomsPayload = await classroomsResponse.json() as ApiResponse<Classroom[]>
        const membersPayload = await membersResponse.json() as ApiResponse<ClassroomMemberSummary[]>
        const assignmentsPayload = await assignmentsResponse.json() as ApiResponse<Assignment[]>

        if (!classroomsResponse.ok) throw new Error(classroomsPayload.error?.message ?? 'Gagal memuat kelas')
        if (!membersResponse.ok) throw new Error(membersPayload.error?.message ?? 'Gagal memuat siswa')
        if (!assignmentsResponse.ok) throw new Error(assignmentsPayload.error?.message ?? 'Gagal memuat penugasan')

        const found = classroomsPayload.data.find((item) => item.id === classroomId) ?? null
        if (!found) throw new Error('Kelas tidak ditemukan')

        if (!controller.signal.aborted) {
          const now = Date.now()
          setClassroom(found)
          setMembers(membersPayload.data)
          setAssignments(assignmentsPayload.data)
          setUpcoming(
            assignmentsPayload.data
              .filter((assignment) => assignment.status === 'published' && assignment.dueAt && Date.parse(assignment.dueAt) > now)
              .sort((left, right) => Date.parse(left.dueAt ?? '') - Date.parse(right.dueAt ?? ''))
              .slice(0, 4),
          )
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [classroomId])

  async function removeMember(studentId: string) {
    setRemovingId(studentId)
    setMemberError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/members/${studentId}`, { method: 'DELETE' })
      const payload = response.status === 204 ? null : await response.json()
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Gagal menghapus siswa')
      setMembers((current) => current.filter((member) => member.studentId !== studentId))
    } catch (cause) {
      setMemberError(cause instanceof Error ? cause.message : 'Gagal menghapus siswa')
    } finally {
      setRemovingId(null)
    }
  }

  const band = classroom ? classBandColor(classroom.id) : '#1d4ed8'
  const published = assignments.filter((assignment) => assignment.status === 'published')

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
        <div className="h-5 w-48 animate-pulse rounded bg-secondary" />
        <div className="h-40 animate-pulse rounded-xl bg-secondary" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
      </div>
    )
  }

  if (error || !classroom) {
    return (
      <div className="mx-auto max-w-5xl">
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error ?? 'Kelas tidak ditemukan'}</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/guru/kelas">Kembali ke daftar kelas</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm">
        <Link href="/guru/kelas" className="font-medium text-primary-deep hover:underline">
          Kelas
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-muted-foreground">{classroom.name}</span>
      </nav>

      <div role="tablist" aria-label="Bagian kelas" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === item.id
                ? 'border-primary text-primary-deep'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-xl px-6 py-8 sm:px-8 sm:py-10"
        style={{ backgroundColor: band }}
      >
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{classroom.name}</h1>
        <p className="mt-1.5 text-sm text-white">{classroom.school ?? 'TuturAI Classroom'}</p>
        <p className="text-sm text-white">{teacherName}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            {members.length} siswa
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            {assignments.length} penugasan
          </span>
          {classroom.status === 'archived' && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">Diarsipkan</span>
          )}
        </div>
      </div>

      {tab === 'stream' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
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
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(assignment.dueAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/guru/penugasan">
                <Plus className="h-4 w-4" />
                Buat penugasan
              </Link>
            </Button>
          </aside>

          <section aria-label="Aktivitas kelas" className="space-y-3">
            {published.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <h2 className="font-heading text-base font-bold text-foreground">Belum ada penugasan</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Penugasan yang dipublish akan muncul di stream kelas ini.
                </p>
                <Button asChild className="mt-4 gap-2">
                  <Link href="/guru/penugasan">
                    <Plus className="h-4 w-4" />
                    Buat penugasan
                  </Link>
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
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                              >
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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
      )}

      {tab === 'classwork' && (
        <section aria-label="Daftar penugasan" className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-heading text-base font-bold text-foreground">Penugasan</h2>
            <Button asChild size="sm" className="gap-2">
              <Link href="/guru/penugasan">
                <Plus className="h-4 w-4" />
                Buat
              </Link>
            </Button>
          </div>
          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              Belum ada penugasan di kelas ini.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {assignments.map((assignment) => (
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
                        {assignment.dueAt ? `Tenggat ${formatDateTime(assignment.dueAt)}` : 'Tanpa tenggat'} ·{' '}
                        {assignment.maxAttempts} attempt
                      </p>
                    </div>
                    <Badge variant={assignment.status === 'published' ? 'secondary' : 'outline'}>
                      {assignment.status === 'published' ? 'Dipublish' : assignment.status === 'draft' ? 'Draft' : 'Diarsipkan'}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'people' && (
        <section aria-label="Anggota kelas" className="mt-6 space-y-6">
          <div>
            <h2 className="mb-3 font-heading text-base font-bold text-foreground">Guru</h2>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: band }}
              >
                {classInitials(teacherName)}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{teacherName}</p>
                <p className="text-xs text-muted-foreground">Guru</p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-bold text-foreground">Siswa</h2>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {members.length} siswa
              </span>
            </div>
            {memberError && (
              <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {memberError}
              </p>
            )}
            {members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa yang bergabung. Bagikan kode join kelas.
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {members.map((member) => (
                  <li key={member.studentId} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                      {classInitials(member.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                      {member.email && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
                    </div>
                    {typeof member.speakingScore === 'number' && (
                      <span className="font-mono text-xs font-semibold text-primary-deep">{member.speakingScore}</span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeMember(member.studentId)}
                      disabled={removingId === member.studentId}
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only">Hapus</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
