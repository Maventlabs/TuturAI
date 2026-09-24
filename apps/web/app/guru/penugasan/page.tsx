'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { Assignment, Classroom } from '@tuturai/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'

export default function TeacherAssignmentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [classroomId, setClassroomId] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAssignments = useCallback(async (id: string) => {
    const response = await fetch(`/api/classrooms/${id}/assignments`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat penugasan')
    setAssignments(payload.data)
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas') } finally { setLoading(false) }
  }, [loadAssignments])

  useEffect(() => { void loadClassrooms() }, [loadClassrooms])

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!classroomId) return
    setSaving(true); setError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, instructions, dueAt: dueAt || null, maxAttempts: Number(maxAttempts), status }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal membuat penugasan')
      let created = payload.data as Assignment
      if (attachment) {
        const form = new FormData()
        form.set('file', attachment)
        form.set('assignmentId', created.id)
        const uploadResponse = await fetch('/api/integrations/google-drive/upload', { method: 'POST', body: form })
        const uploadPayload = await uploadResponse.json()
        if (!uploadResponse.ok) throw new Error(uploadPayload.error?.message ?? 'Gagal mengunggah lampiran ke Google Drive')
        created = uploadPayload.data.assignment
      }
      setAssignments((current) => [created, ...current])
      setTitle(''); setInstructions(''); setDueAt(''); setMaxAttempts('1'); setAttachment(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal membuat penugasan') } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Penugasan" description="Buat tugas speaking dan publish ke classroom yang dipilih." />
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <Card className="p-5">
        <form onSubmit={createAssignment} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Classroom
            <select required value={classroomId} onChange={(event) => { setClassroomId(event.target.value); void loadAssignments(event.target.value) }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3">
              <option value="">Pilih classroom</option>{classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Status saat dibuat
            <select value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'published')} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"><option value="draft">Draft</option><option value="published">Publish sekarang</option></select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">Judul
            <input required minLength={2} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Instruksi
            <textarea required maxLength={5000} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Batas pengumpulan
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="text-sm font-medium">Maksimal attempt
            <input required type="number" min="1" max="10" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Lampiran Google Drive (opsional)
            <input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">PDF, Word, PowerPoint, Excel, atau teks; maksimal 25 MB.</span>
          </label>
          <Button type="submit" disabled={saving || loading || !classroomId} className="sm:col-span-2">{saving ? 'Menyimpan...' : 'Simpan penugasan'}</Button>
        </form>
      </Card>
       <div className="grid gap-3">
          {assignments.map((assignment) => <Card key={assignment.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading font-bold">{assignment.title}</h2><p className="mt-1 text-sm text-muted-foreground">{assignment.instructions}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{assignment.status}</span></div><p className="mt-3 text-xs text-muted-foreground">{assignment.maxAttempts} attempt · {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('id-ID') : 'Tanpa batas waktu'}</p>{assignment.attachments?.length ? <ul className="mt-3 space-y-1 text-xs"><li className="font-semibold">Lampiran</li>{assignment.attachments.map((file) => <li key={file.id}>{file.webViewLink ? <a className="text-primary underline" href={file.webViewLink} target="_blank" rel="noreferrer">{file.name}</a> : <span className="text-muted-foreground">{file.name} · link Drive belum tersedia</span>}</li>)}</ul> : null}</Card>)}
        {!loading && classroomId && assignments.length === 0 && <p className="text-sm text-muted-foreground">Belum ada penugasan di classroom ini.</p>}
      </div>
    </div>
  )
}
