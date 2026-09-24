'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Assignment, Classroom, Submission } from '@tuturai/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'
import { enqueuePendingMutation } from '@/lib/offline/offline-db'

export default function StudentAssignmentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomId, setClassroomId] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({})
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [completedAssignment, setCompletedAssignment] = useState<Assignment | null>(null)

  const loadAssignments = useCallback(async (id: string) => {
    const response = await fetch(`/api/classrooms/${id}/assignments`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat penugasan')
    setAssignments(payload.data)
    const loaded = await Promise.all(payload.data.map(async (assignment: Assignment) => {
      const submissionResponse = await fetch(`/api/assignments/${assignment.id}/submission`, { cache: 'no-store' })
      if (submissionResponse.status === 404) return null
      const submissionPayload = await submissionResponse.json()
      return submissionResponse.ok ? [assignment.id, submissionPayload.data] as const : null
    }))
    setSubmissions(Object.fromEntries(loaded.filter((entry): entry is readonly [string, Submission] => entry !== null)))
  }, [])

  const loadClassrooms = useCallback(async () => {
    try {
      const response = await fetch('/api/classrooms', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat kelas')
      setClassrooms(payload.data)
      const first = payload.data[0]?.id ?? ''
      setClassroomId(first)
      if (first) await loadAssignments(first)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
    } finally {
      setLoading(false)
    }
  }, [loadAssignments])

  useEffect(() => {
    void loadClassrooms()
  }, [loadClassrooms])

  async function submit(assignmentId: string) {
    setAction(assignmentId)
    setError(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      const selectedFile = files[assignmentId]
      if (!navigator.onLine && selectedFile) throw new Error('File submission memerlukan koneksi online agar dapat disimpan ke Google Drive.')
      const body = new FormData()
      if (selectedFile) body.set('file', selectedFile)
      const response = await fetch(`/api/assignments/${assignmentId}/submit`, { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mengumpulkan penugasan')
      setSubmissions((current) => ({ ...current, [assignmentId]: payload.data }))
      setCompletedAssignment(assignments.find((assignment) => assignment.id === assignmentId) ?? null)
    } catch (cause) {
      if (!files[assignmentId] && (cause instanceof TypeError || !navigator.onLine)) {
        await enqueuePendingMutation({ operation: 'submit-assignment', payload: { assignmentId }, idempotencyKey: idempotencyKey })
        setError('Penugasan disimpan di antrean offline dan akan dikirim saat koneksi kembali.')
      } else {
        setError(cause instanceof Error ? cause.message : 'Gagal mengumpulkan penugasan')
      }
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Penugasan Saya" description="Lihat tugas yang dipublish guru dan kumpulkan sesuai batas attempt." />
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Memuat penugasan...</p> : (
        <>
          <label className="block max-w-sm text-sm font-medium">
            Classroom
            <select value={classroomId} onChange={(event) => { setClassroomId(event.target.value); void loadAssignments(event.target.value) }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3">
              <option value="">Pilih classroom</option>
              {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          </label>
          <div className="grid gap-4">
            {assignments.map((assignment) => {
              const submission = submissions[assignment.id]
              const canSubmit = !submission || submission.status === 'returned'
              return (
                <Card key={assignment.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-heading font-bold">{assignment.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{assignment.instructions}</p>
                      <p className="mt-3 text-xs text-muted-foreground">Maks. {assignment.maxAttempts} attempt · {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('id-ID') : 'Tanpa batas waktu'}</p>
                    </div>
                    <Button disabled={!canSubmit || action === assignment.id} onClick={() => void submit(assignment.id)}>
                      {action === assignment.id ? 'Mengirim...' : submission?.status === 'returned' ? 'Kirim ulang' : 'Kumpulkan'}
                    </Button>
                  </div>
                  {canSubmit && <label className="mt-4 block text-sm font-medium">File submission (opsional)<input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt" onChange={(event) => setFiles((current) => ({ ...current, [assignment.id]: event.target.files?.[0] ?? null }))} className="mt-1 block w-full text-sm" /></label>}
                  {submission && <p className="mt-3 text-xs font-medium text-muted-foreground">Status: {submission.status} · Attempt {submission.attempt}</p>}
                </Card>
              )
            })}
          </div>
        </>
      )}
      <CompletionDialog
        open={completedAssignment !== null}
        title="Penugasan terkumpul"
        message={completedAssignment ? `${completedAssignment.title} sudah diterima server.` : ''}
        score="Terkirim"
        detail="Status submission sudah diperbarui dan dapat ditinjau guru."
        onClose={() => setCompletedAssignment(null)}
      />
    </div>
  )
}
