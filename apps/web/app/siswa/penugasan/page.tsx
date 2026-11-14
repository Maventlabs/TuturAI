'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Assignment, Classroom, Submission } from '@tuturai/domain'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'
import { ClassroomSwitch } from '@/components/student/classroom/classroom-switch'
import { AssignmentRow, assignmentState } from '@/components/student/classroom/assignment-row'
import { AssignmentSheet } from '@/components/student/classroom/assignment-sheet'
import { ClassroomReadouts, type ClassroomReadout } from '@/components/student/classroom/readout-strip'
import { RailPanel } from '@/components/student/classroom/rail-panel'
import { formatDue, relativeDue } from '@/components/student/classroom/format'
import { enqueuePendingMutation } from '@/lib/offline/offline-db'
import { cn } from '@/lib/utils'

// The date is formatted in the viewer's timezone, so it is read only after
// hydration — the server snapshot stays null to keep SSR and client in sync.
const subscribeToNothing = () => () => {}
const getTodayLabel = () =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())

export default function StudentAssignmentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomId, setClassroomId] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [completedAssignment, setCompletedAssignment] = useState<Assignment | null>(null)
  const [joinKey, setJoinKey] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMessage, setJoinMessage] = useState<string | null>(null)
  const today = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => null)
  // Relative deadlines ("besok") depend on the clock, so they only render after
  // hydration; the server snapshot stays false to keep both renders identical.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )

  const loadAssignments = useCallback(async (id: string) => {
    const response = await fetch(`/api/classrooms/${id}/assignments`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat penugasan')
    setAssignments(payload.data)
    const loaded = await Promise.all(
      payload.data.map(async (assignment: Assignment) => {
        const submissionResponse = await fetch(`/api/assignments/${assignment.id}/submission`, {
          cache: 'no-store',
        })
        if (submissionResponse.status === 404) return null
        const submissionPayload = await submissionResponse.json()
        return submissionResponse.ok
          ? ([assignment.id, submissionPayload.data] as const)
          : null
      }),
    )
    setSubmissions(
      Object.fromEntries(
        loaded.filter((entry): entry is readonly [string, Submission] => entry !== null),
      ),
    )
  }, [])

  const loadClassrooms = useCallback(async () => {
    try {
      const response = await fetch('/api/classrooms', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat kelas')
      setClassrooms(payload.data)
      const stored =
        typeof window === 'undefined' ? null : window.localStorage.getItem('tuturai.activeClassroomId')
      const next =
        payload.data.find((classroom: Classroom) => classroom.id === stored)?.id ??
        payload.data[0]?.id ??
        ''
      setClassroomId(next)
      if (next) await loadAssignments(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
    } finally {
      setLoading(false)
    }
  }, [loadAssignments])

  useEffect(() => {
    void loadClassrooms()
  }, [loadClassrooms])

  const selectClassroom = useCallback(
    (id: string) => {
      setClassroomId(id)
      window.localStorage.setItem('tuturai.activeClassroomId', id)
      setLoading(true)
      setError(null)
      void loadAssignments(id)
        .catch((cause) => setError(cause instanceof Error ? cause.message : 'Gagal memuat penugasan'))
        .finally(() => setLoading(false))
    },
    [loadAssignments],
  )

  async function submit(assignment: Assignment, file: File | null) {
    setSubmittingId(assignment.id)
    setSubmitError(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      const body = new FormData()
      if (file) body.set('file', file)
      const response = await fetch(`/api/assignments/${assignment.id}/submit`, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mengumpulkan penugasan')
      setSubmissions((current) => ({ ...current, [assignment.id]: payload.data }))
      setOpenAssignmentId(null)
      setCompletedAssignment(assignment)
    } catch (cause) {
      if (cause instanceof TypeError || !navigator.onLine) {
        await enqueuePendingMutation({
          operation: 'submit-assignment',
          payload: { assignmentId: assignment.id, file },
          idempotencyKey,
        })
        setSubmitError('Penugasan disimpan di antrean offline dan akan dikirim saat koneksi kembali.')
      } else {
        setSubmitError(cause instanceof Error ? cause.message : 'Gagal mengumpulkan penugasan')
      }
    } finally {
      setSubmittingId(null)
    }
  }

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setJoining(true)
    setJoinMessage(null)
    try {
      const response = await fetch('/api/classrooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinKey }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal bergabung ke classroom')
      setJoinKey('')
      setJoinMessage(`Berhasil bergabung ke ${payload.data.name}`)
      await loadClassrooms()
    } catch (cause) {
      setJoinMessage(cause instanceof Error ? cause.message : 'Gagal bergabung ke classroom')
    } finally {
      setJoining(false)
    }
  }

  const activeClassroom = classrooms.find((classroom) => classroom.id === classroomId) ?? null

  const counts = useMemo(() => {
    const result = { todo: 0, pending: 0, approved: 0, returned: 0, late: 0 }
    for (const assignment of assignments) {
      const submission = submissions[assignment.id] ?? null
      const state = assignmentState(submission)
      if (state === 'todo') result.todo += 1
      else if (state === 'pending_review') result.pending += 1
      else if (state === 'approved') result.approved += 1
      else result.returned += 1
      if (submission?.isLate) result.late += 1
    }
    return result
  }, [assignments, submissions])

  const upcoming = useMemo(
    () =>
      assignments
        .filter(
          (assignment) =>
            assignment.dueAt && assignmentState(submissions[assignment.id] ?? null) !== 'approved',
        )
        .sort((left, right) => (left.dueAt ?? '').localeCompare(right.dueAt ?? ''))
        .slice(0, 3),
    [assignments, submissions],
  )

  const nextDue = upcoming[0] ?? null

  const insight = loading
    ? 'Memuat penugasan…'
    : classrooms.length === 0
      ? 'Belum ada classroom. Gabung dengan kode dari guru untuk menerima tugas.'
      : assignments.length === 0
        ? `Tidak ada tugas published di ${activeClassroom?.name ?? 'classroom ini'}.`
        : counts.todo > 0
          ? `${counts.todo} tugas belum dikumpulkan${counts.pending > 0 ? `, ${counts.pending} menunggu review` : ''}.${nextDue?.dueAt ? ` Tenggat terdekat ${formatDue(nextDue.dueAt)}.` : ''}`
          : counts.pending > 0
            ? `Semua tugas sudah dikumpulkan. ${counts.pending} menunggu review guru.`
            : 'Semua tugas di classroom ini sudah selesai.'

  const readouts: ClassroomReadout[] = [
    { label: 'Tugas', value: String(assignments.length), note: activeClassroom?.name ?? 'classroom' },
    {
      label: 'Belum',
      value: String(counts.todo),
      note: 'belum dikumpulkan',
      tone: counts.todo > 0 ? 'attention' : 'default',
    },
    { label: 'Review', value: String(counts.pending), note: 'menunggu guru' },
    { label: 'Selesai', value: String(counts.approved), note: 'disetujui' },
    {
      label: 'Terlambat',
      value: String(counts.late),
      note: 'submission',
      tone: counts.late > 0 ? 'attention' : 'default',
    },
  ]

  const segments = [
    { key: 'approved', label: 'Disetujui', count: counts.approved, className: 'bg-primary' },
    { key: 'pending', label: 'Menunggu review', count: counts.pending, className: 'bg-warning' },
    { key: 'returned', label: 'Dikembalikan', count: counts.returned, className: 'bg-destructive' },
    { key: 'todo', label: 'Belum dikumpulkan', count: counts.todo, className: 'bg-foreground/15' },
  ]
  const totalForBar = assignments.length || 1

  const openAssignment = assignments.find((assignment) => assignment.id === openAssignmentId) ?? null

  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadClassrooms()}>
            Coba lagi
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-rule px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Classroom{today ? ` · ${today}` : ''}
            </p>
            <ClassroomSwitch classrooms={classrooms} value={classroomId} onChange={selectClassroom} />
          </div>
          <h1 className="mt-4 max-w-[52ch] text-balance font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
            {insight}
          </h1>
        </header>

        <ClassroomReadouts items={readouts} />

        {loading ? (
          <div className="border-t border-rule px-5 py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Memuat penugasan
          </div>
        ) : classrooms.length === 0 ? (
          <div className="border-t border-rule px-5 py-10">
            <div className="mx-auto max-w-sm">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/70">
                Belum ada classroom
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Masukkan kode join dari guru untuk mulai menerima tugas.
              </p>
              <form onSubmit={join} className="mt-4 flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Kode join classroom</span>
                  <input
                    value={joinKey}
                    onChange={(event) => setJoinKey(event.target.value)}
                    placeholder="Kode join"
                    autoComplete="off"
                    className="h-9 w-full border border-border bg-background px-3 font-mono text-[13px] uppercase tracking-[0.2em] text-foreground outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  />
                </label>
                <Button type="submit" disabled={joining || !joinKey.trim()} className="h-9 shrink-0">
                  {joining ? 'Menggabung…' : 'Gabung'}
                </Button>
              </form>
              {joinMessage && (
                <p role="status" className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {joinMessage}
                </p>
              )}
            </div>
          </div>
        ) : assignments.length === 0 ? (
          <div className="border-t border-rule px-5 py-10">
            <div className="border-l-2 border-primary/25 pl-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/70">
                Belum ada tugas
              </p>
              <p className="mt-1.5 max-w-[40ch] text-[12px] leading-relaxed text-muted-foreground">
                Tugas yang dipublish guru untuk {activeClassroom?.name ?? 'classroom ini'} akan muncul di
                sini.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px border-t border-rule bg-rule lg:grid-cols-[1fr_320px]">
            <section className="bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
                <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Antrean tugas
                </h2>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  {assignments.length} tugas
                </span>
              </header>
              <ul>
                {assignments.map((assignment) => (
                  <AssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    submission={submissions[assignment.id] ?? null}
                    onOpen={() => {
                      setSubmitError(null)
                      setOpenAssignmentId(assignment.id)
                    }}
                  />
                ))}
              </ul>
              <footer className="border-t border-rule px-4 py-3 sm:px-5">
                <ol className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {['Buka tugas', 'Lampirkan file (opsional)', 'Kumpulkan'].map((step, index) => (
                    <li key={step} className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] tabular-nums text-muted-foreground/60">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11.5px] leading-none text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </footer>
            </section>

            <aside className="flex flex-col gap-px bg-rule">
              <RailPanel label="Status pengumpulan" meta={`${assignments.length} tugas`}>
                <div
                  className="flex h-2 w-full overflow-hidden bg-secondary"
                  role="img"
                  aria-label={segments.map((segment) => `${segment.label} ${segment.count}`).join(', ')}
                >
                  {segments.map((segment) =>
                    segment.count > 0 ? (
                      <div
                        key={segment.key}
                        className={segment.className}
                        style={{ width: `${(segment.count / totalForBar) * 100}%` }}
                      />
                    ) : null,
                  )}
                </div>
                <ul className="mt-3 space-y-2">
                  {segments.map((segment) => (
                    <li key={segment.key} className="flex items-center gap-2">
                      <span className={cn('size-2 shrink-0', segment.className)} aria-hidden="true" />
                      <span className="flex-1 text-[12px] leading-none text-muted-foreground">
                        {segment.label}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-foreground">
                        {segment.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </RailPanel>

              <RailPanel label="Tenggat terdekat" meta={`${upcoming.length} aktif`}>
                {upcoming.length === 0 ? (
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Tidak ada tenggat aktif. Semua tugas sudah disetujui atau belum bertenggat.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {upcoming.map((assignment) => (
                      <li key={assignment.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitError(null)
                            setOpenAssignmentId(assignment.id)
                          }}
                          className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          <span className="block truncate text-[12.5px] font-medium text-foreground group-hover:text-primary-deep">
                            {assignment.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                            <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
                            {assignment.dueAt ? formatDue(assignment.dueAt) : 'Tanpa tenggat'}
                            {hydrated && assignment.dueAt && (
                              <span className="text-muted-foreground/60">
                                · {relativeDue(assignment.dueAt)}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </RailPanel>
              {/* Keeps the hairline column filled when the list is taller than the rail. */}
              <div className="flex-1 bg-card" aria-hidden />
            </aside>
          </div>
        )}
      </div>

      <AssignmentSheet
        assignment={openAssignment}
        submission={openAssignment ? (submissions[openAssignment.id] ?? null) : null}
        classroomName={activeClassroom?.name ?? 'Classroom'}
        open={openAssignment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenAssignmentId(null)
            setSubmitError(null)
          }
        }}
        onSubmit={submit}
        submitting={openAssignment !== null && submittingId === openAssignment.id}
        error={submitError}
      />

      <CompletionDialog
        open={completedAssignment !== null}
        title="Penugasan terkumpul"
        message={completedAssignment ? `${completedAssignment.title} sudah diterima server.` : ''}
        score="Terkirim"
        detail="Status submission sudah diperbarui dan dapat ditinjau guru."
        reaction="assignment"
        onClose={() => setCompletedAssignment(null)}
      />
    </div>
  )
}
