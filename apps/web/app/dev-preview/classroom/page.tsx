'use client'

import { useState } from 'react'
import type { Assignment, Classroom, Submission } from '@tuturai/domain'
import { ClassroomSwitch } from '@/components/student/classroom/classroom-switch'
import { AssignmentRow } from '@/components/student/classroom/assignment-row'
import { AssignmentSheet } from '@/components/student/classroom/assignment-sheet'
import { ClassroomReadouts } from '@/components/student/classroom/readout-strip'
import { RailPanel } from '@/components/student/classroom/rail-panel'
import { ActivityHeatmap, type ActivityDay } from '@/components/student/activity-heatmap'
import { formatDue, relativeDue } from '@/components/student/classroom/format'

const classrooms = [
  { id: 'c1', name: 'XI Bahasa 2' },
  { id: 'c2', name: 'XI Bahasa 1' },
] as unknown as Classroom[]

const assignments = [
  {
    id: 'a1',
    classId: 'c1',
    title: 'Grammar checkpoint: past tense',
    instructions: 'Kerjakan 10 soal past tense lalu tinjau pembahasannya.',
    dueAt: '2026-11-18T16:59:00.000Z',
    maxAttempts: 3,
    status: 'published',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a2',
    classId: 'c1',
    title: 'Role-play: di stasiun kereta',
    instructions: 'Latih percakapan sopan saat membeli tiket kereta.',
    dueAt: '2026-11-20T16:59:00.000Z',
    maxAttempts: 2,
    status: 'published',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a3',
    classId: 'c1',
    title: 'Speaking check-in mingguan',
    instructions: 'Rekam ringkasan satu menit tentang kegiatanmu minggu ini.',
    dueAt: '2026-11-16T16:59:00.000Z',
    maxAttempts: 2,
    status: 'published',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a4',
    classId: 'c1',
    title: 'Listening: announcement at the airport',
    instructions: 'Dengarkan pengumuman lalu jawab lima pertanyaan pemahaman.',
    dueAt: null,
    maxAttempts: 1,
    status: 'published',
    createdAt: '',
    updatedAt: '',
  },
] as unknown as Assignment[]

const submissions: Record<string, Submission> = {
  a1: {
    id: 's1',
    assignmentId: 'a1',
    studentId: 'u1',
    attempt: 1,
    status: 'pending_review',
    isLate: false,
    teacherFeedback: null,
    submittedAt: '2026-11-12T09:00:00.000Z',
    updatedAt: '',
  },
  a2: {
    id: 's2',
    assignmentId: 'a2',
    studentId: 'u1',
    attempt: 1,
    status: 'returned',
    isLate: true,
    teacherFeedback: 'Bagian pembuka sudah bagus. Tambahkan satu kalimat penutup dan ulangi rekamannya.',
    submittedAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '',
  },
  a4: {
    id: 's4',
    assignmentId: 'a4',
    studentId: 'u1',
    attempt: 1,
    status: 'approved',
    isLate: false,
    teacherFeedback: null,
    submittedAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '',
  },
}

function mockDays(): ActivityDay[] {
  const days: ActivityDay[] = []
  const end = Date.UTC(2026, 10, 14)
  for (let index = 370; index >= 0; index--) {
    const date = new Date(end - index * 86_400_000).toISOString().slice(0, 10)
    const seed = (index * 2654435761) % 100
    const count = seed > 62 ? (seed % 5) + 1 : seed > 48 ? 1 : 0
    days.push({ date, count })
  }
  return days
}

export default function ClassroomPreviewPage() {
  const [classroomId, setClassroomId] = useState('c1')
  const [openId, setOpenId] = useState<string | null>(null)
  const [days] = useState<ActivityDay[]>(() => mockDays())

  const counts = { todo: 1, pending: 1, approved: 1, returned: 1, late: 1 }
  const segments = [
    { key: 'approved', label: 'Disetujui', count: counts.approved, className: 'bg-primary' },
    { key: 'pending', label: 'Menunggu review', count: counts.pending, className: 'bg-warning' },
    { key: 'returned', label: 'Dikembalikan', count: counts.returned, className: 'bg-destructive' },
    { key: 'todo', label: 'Belum dikumpulkan', count: counts.todo, className: 'bg-foreground/15' },
  ]
  const openAssignment = assignments.find((assignment) => assignment.id === openId) ?? null

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="border-b border-rule px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Classroom · 14 Nov 2026
              </p>
              <ClassroomSwitch classrooms={classrooms} value={classroomId} onChange={setClassroomId} />
            </div>
            <h1 className="mt-4 max-w-[52ch] text-balance font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
              1 tugas belum dikumpulkan, 1 menunggu review. Tenggat terdekat 16 Nov 2026.
            </h1>
          </header>

          <ClassroomReadouts
            items={[
              { label: 'Tugas', value: '4', note: 'XI Bahasa 2' },
              { label: 'Belum', value: '1', note: 'belum dikumpulkan', tone: 'attention' },
              { label: 'Review', value: '1', note: 'menunggu guru' },
              { label: 'Selesai', value: '1', note: 'disetujui' },
              { label: 'Terlambat', value: '1', note: 'submission', tone: 'attention' },
            ]}
          />

          <div className="grid grid-cols-1 gap-px border-t border-rule bg-rule lg:grid-cols-[1fr_320px]">
            <section className="bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
                <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Antrean tugas
                </h2>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">4 tugas</span>
              </header>
              <ul>
                {assignments.map((assignment) => (
                  <AssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    submission={submissions[assignment.id] ?? null}
                    onOpen={() => setOpenId(assignment.id)}
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
              <RailPanel label="Status pengumpulan" meta="4 tugas">
                <div className="flex h-2 w-full overflow-hidden bg-secondary">
                  {segments.map((segment) => (
                    <div
                      key={segment.key}
                      className={segment.className}
                      style={{ width: `${(segment.count / 4) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-2">
                  {segments.map((segment) => (
                    <li key={segment.key} className="flex items-center gap-2">
                      <span className={`size-2 shrink-0 ${segment.className}`} aria-hidden="true" />
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

              <RailPanel label="Tenggat terdekat" meta="3 aktif">
                <ul className="space-y-3">
                  {assignments.slice(0, 3).map((assignment) => (
                    <li key={assignment.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(assignment.id)}
                        className="block w-full text-left"
                      >
                        <span className="block truncate text-[12.5px] font-medium text-foreground">
                          {assignment.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                          {assignment.dueAt ? formatDue(assignment.dueAt) : 'Tanpa tenggat'}
                          {assignment.dueAt && (
                            <span className="text-muted-foreground/60">· {relativeDue(assignment.dueAt)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </RailPanel>

              <div className="flex-1 bg-card" aria-hidden />
            </aside>
          </div>
        </div>

        <div className="mt-8">
          <ActivityHeatmap days={days} />
        </div>
      </div>

      <AssignmentSheet
        assignment={openAssignment}
        submission={openAssignment ? (submissions[openAssignment.id] ?? null) : null}
        classroomName="XI Bahasa 2"
        open={openAssignment !== null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
        onSubmit={() => undefined}
        submitting={false}
        error={null}
      />
    </div>
  )
}
