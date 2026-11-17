'use client'

import { useState } from 'react'
import type { Assignment, Submission } from '@tuturai/domain'
import { ClassworkPanel, type ComposerKind } from '@/components/guru/classwork-panel'
import { AssignmentSheet } from '@/components/student/classroom/assignment-sheet'

const assignment: Assignment = {
  id: 'preview',
  classId: 'preview',
  title: 'Speaking: describing your daily routine',
  instructions:
    'Rekam 90 detik penjelasan rutinitas harianmu. Sebutkan minimal lima aktivitas dan gunakan simple present tense.',
  dueAt: new Date(Date.now() + 86_400_000).toISOString(),
  maxAttempts: 2,
  status: 'published',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attachments: [],
  links: [
    { id: 'l1', label: 'Rubrik penilaian', url: 'https://drive.google.com/file/d/rubrik/view' },
    { id: 'l2', label: 'Contoh rekaman', url: 'https://youtu.be/contoh' },
  ],
}

const submission: Submission = {
  id: 'preview',
  assignmentId: 'preview',
  studentId: 'preview',
  attempt: 1,
  status: 'returned',
  isLate: false,
  teacherFeedback: 'Artikulasi sudah jelas, tambahkan variasi intonasi pada kalimat tanya.',
  submittedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  files: [],
  links: [{ id: 's1', label: 'drive.google.com', url: 'https://drive.google.com/file/d/mine/view' }],
}

export default function PreviewComposerPage() {
  const [composer, setComposer] = useState<ComposerKind | null>('assignment')
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
      >
        Buka sheet siswa
      </button>
      <ClassworkPanel
        classroomId="preview"
        assignments={[assignment]}
        materials={[]}
        composer={composer}
        onComposerChange={setComposer}
        onRefresh={async () => {}}
      />
      <AssignmentSheet
        assignment={assignment}
        submission={submission}
        classroomName="XI IPA 2"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={() => {}}
        submitting={false}
        error={null}
      />
    </main>
  )
}
