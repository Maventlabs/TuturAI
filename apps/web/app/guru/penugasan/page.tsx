'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { Assignment, Classroom } from '@tuturai/domain'
import {
  CalendarClock,
  ChevronDown,
  FileText,
  Loader2,
  Minus,
  Paperclip,
  Plus,
  Repeat2,
  Send,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { toDeadlineIso } from '@/lib/assignment-deadline'
import { cn } from '@/lib/utils'

const fieldLabel =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

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
  const [pendingAttachment, setPendingAttachment] = useState<{ assignment: Assignment; publishAfterUpload: boolean } | null>(null)

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

  async function publishAssignment(assignmentId: string) {
    const response = await fetch(`/api/assignments/${assignmentId}/publish`, { method: 'POST' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mempublish penugasan')
    return payload.data as Assignment
  }

  async function publishDraftFromList(assignmentId: string) {
    setSaving(true); setError(null)
    try {
      const published = await publishAssignment(assignmentId)
      setAssignments((current) => [published, ...current.filter((item) => item.id !== published.id)])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mempublish penugasan')
    } finally {
      setSaving(false)
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!classroomId && !pendingAttachment) return
    setSaving(true); setError(null)
    try {
      let created: Assignment
      let publishAfterUpload = status === 'published'
      if (pendingAttachment) {
        created = pendingAttachment.assignment
        publishAfterUpload = pendingAttachment.publishAfterUpload
      } else {
        const deferPublish = Boolean(attachment) && status === 'published'
        const response = await fetch(`/api/classrooms/${classroomId}/assignments`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, instructions, dueAt: toDeadlineIso(dueAt), maxAttempts: Number(maxAttempts), status: deferPublish ? 'draft' : status }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal membuat penugasan')
        created = payload.data as Assignment
        publishAfterUpload = deferPublish
        if (attachment) {
          setPendingAttachment({ assignment: created, publishAfterUpload })
          setAssignments((current) => [created, ...current.filter((item) => item.id !== created.id)])
        }
      }

      if (attachment) {
        const form = new FormData()
        form.set('file', attachment)
        form.set('assignmentId', created.id)
        const uploadResponse = await fetch('/api/integrations/google-drive/upload', { method: 'POST', body: form })
        const uploadPayload = await uploadResponse.json()
        if (!uploadResponse.ok) throw new Error(uploadPayload.error?.message ?? 'Gagal mengunggah lampiran ke Google Drive')
        created = uploadPayload.data.assignment
        setPendingAttachment({ assignment: created, publishAfterUpload })
        setAssignments((current) => [created, ...current.filter((item) => item.id !== created.id)])
      }
      if (publishAfterUpload && created.status === 'draft') {
        created = await publishAssignment(created.id)
      }
      setAssignments((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setPendingAttachment(null)
      setTitle(''); setInstructions(''); setDueAt(''); setMaxAttempts('1'); setAttachment(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal membuat penugasan') } finally { setSaving(false) }
  }

  const locked = Boolean(pendingAttachment)
  const activeClassroom = classrooms.find((classroom) => classroom.id === classroomId)

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader title="Penugasan" description="Buat tugas speaking dan publish ke classroom yang dipilih." />

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={createAssignment} className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden p-0 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3">
            <div className="relative">
              <select
                required
                disabled={locked}
                value={classroomId}
                aria-label="Classroom tujuan"
                onChange={(event) => { setClassroomId(event.target.value); void loadAssignments(event.target.value) }}
                className="h-9 max-w-[280px] appearance-none truncate rounded-full border border-border bg-card pl-3.5 pr-9 text-sm font-semibold text-foreground outline-none ring-ring focus-visible:ring-2 disabled:opacity-60"
              >
                <option value="">Pilih classroom</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">
              {activeClassroom ? 'Tugas speaking' : 'Belum ada classroom dipilih'}
            </span>
          </div>

          <div className="px-5 pt-5">
            <label htmlFor="assignment-title" className="sr-only">Judul penugasan</label>
            <input
              id="assignment-title"
              required
              disabled={locked}
              minLength={2}
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Judul penugasan"
              className="w-full border-0 bg-transparent font-heading text-2xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-60"
            />
            <div className="mt-3 h-px bg-border" />
            <label htmlFor="assignment-instructions" className="sr-only">Instruksi</label>
            <textarea
              id="assignment-instructions"
              required
              disabled={locked}
              maxLength={5000}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Tulis instruksi untuk siswa — misalnya topik, durasi rekaman, dan aspek yang dinilai."
              className="mt-3 min-h-44 w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
            />
          </div>

          <div className="border-t border-border px-5 py-4">
            <p className={fieldLabel}>Lampiran</p>
            <label
              className={cn(
                'mt-2 flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-3 transition-colors',
                locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {attachment ? attachment.name : 'Pilih file dari perangkat'}
              </span>
              {attachment && !locked && (
                <button
                  type="button"
                  onClick={(event) => { event.preventDefault(); setAttachment(null) }}
                  aria-label="Hapus lampiran"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                type="file"
                disabled={locked}
                accept=".pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG, WebP, PDF, Word, PowerPoint, Excel, atau teks. Maksimal 25 MB.
            </p>
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="space-y-5 p-5">
            <div>
              <p className={fieldLabel}>Status saat dibuat</p>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
                {(['draft', 'published'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={locked}
                    onClick={() => setStatus(value)}
                    aria-pressed={status === value}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
                      status === value
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {value === 'draft' ? 'Draft' : 'Publish'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="due-at" className={fieldLabel}>Batas pengumpulan</label>
              <input
                id="due-at"
                type="datetime-local"
                disabled={locked}
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2 disabled:opacity-60"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Kosongkan bila tanpa batas waktu.</p>
            </div>

            <div>
              <label htmlFor="max-attempts" className={fieldLabel}>Maksimal attempt</label>
              <div className="mt-2 flex items-center gap-1 rounded-lg border border-border p-1">
                <button
                  type="button"
                  disabled={locked || Number(maxAttempts) <= 1}
                  onClick={() => setMaxAttempts(String(Math.max(1, Number(maxAttempts) - 1)))}
                  aria-label="Kurangi attempt"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  id="max-attempts"
                  required
                  disabled={locked}
                  type="number"
                  min="1"
                  max="10"
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(event.target.value)}
                  className="w-full border-0 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={locked || Number(maxAttempts) >= 10}
                  onClick={() => setMaxAttempts(String(Math.min(10, Number(maxAttempts) + 1)))}
                  aria-label="Tambah attempt"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {pendingAttachment && (
              <p role="status" className="rounded-lg bg-warning/10 p-3 text-xs text-warning">
                Draft tersimpan. Lampiran belum terkonfirmasi — kirim ulang untuk menyelesaikan upload dan publish.
              </p>
            )}

            <Button
              type="submit"
              disabled={saving || loading || (!classroomId && !pendingAttachment)}
              className="w-full"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : pendingAttachment ? (
                'Coba lagi: upload & publish'
              ) : (
                'Simpan penugasan'
              )}
            </Button>
          </Card>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-sm font-bold text-foreground">Penugasan di kelas ini</h2>
          <span className="text-xs tabular-nums text-muted-foreground">{assignments.length} penugasan</span>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground" role="status" aria-busy="true">Memuat penugasan...</Card>
        ) : !classroomId ? (
          <Card className="p-6 text-sm text-muted-foreground" role="status">Pilih classroom untuk melihat penugasan.</Card>
        ) : assignments.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-heading text-sm font-bold text-foreground">Belum ada penugasan</p>
            <p className="max-w-xs text-pretty text-sm text-muted-foreground">
              Penugasan yang Anda simpan untuk kelas ini akan muncul di sini.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {assignments.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                saving={saving}
                onPublish={publishDraftFromList}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AssignmentRow({
  assignment,
  saving,
  onPublish,
}: {
  assignment: Assignment
  saving: boolean
  onPublish: (id: string) => void
}) {
  const published = assignment.status === 'published'

  return (
    <li>
      <Card className="flex flex-wrap items-start gap-4 p-4 transition-colors hover:border-primary/30">
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            published ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
          )}
        >
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-bold text-foreground">{assignment.title}</h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                published ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
              )}
            >
              {published ? 'Published' : 'Draft'}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{assignment.instructions}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {assignment.dueAt
                ? new Date(assignment.dueAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Tanpa batas waktu'}
            </span>
            <span className="flex items-center gap-1.5">
              <Repeat2 className="h-3.5 w-3.5" />
              {assignment.maxAttempts} attempt
            </span>
            {assignment.attachments?.length ? (
              <span className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                {assignment.attachments.length} lampiran
              </span>
            ) : null}
          </div>
          {assignment.attachments?.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {assignment.attachments.map((file) => (
                <li key={file.id}>
                  {file.webViewLink ? (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      <Paperclip className="h-3 w-3" />
                      {file.name}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {file.name} · link Drive belum tersedia
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {!published && (
          <Button size="sm" disabled={saving} onClick={() => onPublish(assignment.id)}>
            <Send className="h-3.5 w-3.5" />
            Publish
          </Button>
        )}
      </Card>
    </li>
  )
}
