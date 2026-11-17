'use client'

import { FormEvent, useRef, useState } from 'react'
import Link from 'next/link'
import type { Assignment, Material } from '@tuturai/domain'
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FileText,
  Link2,
  Loader2,
  Minus,
  Paperclip,
  Plus,
  Repeat2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeadlinePicker } from '@/components/guru/deadline-picker'
import { FileDrop } from '@/components/shared/file-drop'
import { LinkListEditor, toLinkPayload, type DraftLink } from '@/components/shared/link-list-editor'
import { cn } from '@/lib/utils'

export type ComposerKind = 'assignment' | 'material'

const fieldLabel = 'block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'
const ACCEPTED_FILES = '.pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ClassworkPanel({
  classroomId,
  assignments,
  materials,
  composer,
  onComposerChange,
  onRefresh,
}: {
  classroomId: string
  assignments: Assignment[]
  materials: Material[]
  composer: ComposerKind | null
  onComposerChange: (kind: ComposerKind | null) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Classwork</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Penugasan dan materi yang dibagikan ke kelas ini.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Buat
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => onComposerChange('assignment')} className="items-start gap-2.5 py-2">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium text-foreground">Penugasan</span>
                <span className="block text-xs text-muted-foreground">Tugas speaking dengan tenggat</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onComposerChange('material')} className="items-start gap-2.5 py-2">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium text-foreground">Materi</span>
                <span className="block text-xs text-muted-foreground">Bahan bacaan atau referensi</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {composer && (
        <Composer
          key={composer}
          kind={composer}
          classroomId={classroomId}
          onClose={() => onComposerChange(null)}
          onCreated={async () => {
            onComposerChange(null)
            await onRefresh()
          }}
        />
      )}

      <section aria-label="Penugasan" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-heading text-sm font-bold text-foreground">Penugasan</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{assignments.length}</span>
        </div>
        {assignments.length === 0 ? (
          <EmptyRow
            icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
            text="Belum ada penugasan. Buat penugasan pertama lewat tombol Buat."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {assignments.map((assignment) => {
              const published = assignment.status === 'published'
              return (
                <li key={assignment.id}>
                  <Link
                    href={`/guru/penilaian/${assignment.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-deep">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{assignment.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" aria-hidden="true" />
                          {assignment.dueAt ? formatDateTime(assignment.dueAt) : 'Tanpa tenggat'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="h-3 w-3" aria-hidden="true" />
                          {assignment.maxAttempts} attempt
                        </span>
                        {assignment.attachments?.length ? (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" aria-hidden="true" />
                            {assignment.attachments.length}
                          </span>
                        ) : null}
                        {assignment.links?.length ? (
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" aria-hidden="true" />
                            {assignment.links.length}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        published ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
                      )}
                    >
                      {published ? 'Publish' : assignment.status === 'draft' ? 'Draft' : 'Arsip'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-label="Materi" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-heading text-sm font-bold text-foreground">Materi</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{materials.length}</span>
        </div>
        {materials.length === 0 ? (
          <EmptyRow
            icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            text="Belum ada materi. Tambahkan bahan bacaan atau referensi untuk siswa."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {materials.map((material) => (
              <li key={material.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{material.title}</p>
                    {material.topic && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {material.topic}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{material.description}</p>
                </div>
                {material.attachments.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    {material.attachments.length}
                  </span>
                )}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    material.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
                  )}
                >
                  {material.status === 'published' ? 'Publish' : 'Draft'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {icon}
      </span>
      <p className="text-pretty">{text}</p>
    </div>
  )
}

function Composer({
  kind,
  classroomId,
  onClose,
  onCreated,
}: {
  kind: ComposerKind
  classroomId: string
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const isAssignment = kind === 'assignment'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState('')
  const [dueAt, setDueAt] = useState<Date | null>(null)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [links, setLinks] = useState<DraftLink[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set once the assignment exists on the server: a failed attachment upload
  // must not be retried by creating a second assignment.
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [failedFiles, setFailedFiles] = useState<File[]>([])
  const uploadKeys = useRef(new Map<File, string>())

  async function uploadAttachments(assignmentId: string, queue: File[]) {
    const failed: File[] = []
    let message: string | null = null
    for (const file of queue) {
      const form = new FormData()
      form.set('file', file)
      form.set('assignmentId', assignmentId)
      const key = uploadKeys.current.get(file) ?? crypto.randomUUID()
      uploadKeys.current.set(file, key)
      try {
        const response = await fetch('/api/integrations/google-drive/upload', {
          method: 'POST',
          body: form,
          headers: { 'Idempotency-Key': key },
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          message = payload?.error?.message ?? 'Lampiran gagal diunggah'
          failed.push(file)
        }
      } catch {
        message = 'Lampiran gagal diunggah. Periksa koneksi lalu coba lagi.'
        failed.push(file)
      }
    }
    return { failed, message }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (createdId) {
        const retry = await uploadAttachments(createdId, failedFiles)
        if (retry.failed.length > 0) {
          setFailedFiles(retry.failed)
          setError(retry.message ?? 'Lampiran masih gagal diunggah')
          return
        }
        await onCreated()
        return
      }

      const endpoint = isAssignment
        ? `/api/classrooms/${classroomId}/assignments`
        : `/api/classrooms/${classroomId}/materials`
      const payload = isAssignment
        ? {
            title,
            instructions: body,
            dueAt: dueAt ? dueAt.toISOString() : null,
            maxAttempts,
            status,
            links: toLinkPayload(links),
          }
        : { title, description: body, topic: topic.trim() || null, status }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'Gagal menyimpan')

      if (isAssignment && files.length > 0) {
        const assignmentId = result.data?.id
        if (typeof assignmentId === 'string') {
          setCreatedId(assignmentId)
          const upload = await uploadAttachments(assignmentId, files)
          if (upload.failed.length > 0) {
            setFailedFiles(upload.failed)
            setError(
              `Penugasan sudah tersimpan, tetapi ${upload.failed.length} lampiran gagal diunggah. ${upload.message ?? ''}`.trim(),
            )
            return
          }
        }
      }

      await onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const submitLabel = createdId ? 'Selesai' : 'Simpan'

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary-deep">
            {isAssignment ? (
              <ClipboardList className="size-3.5" aria-hidden="true" />
            ) : (
              <BookOpen className="size-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="text-[13px] font-semibold text-foreground">
            {isAssignment ? 'Penugasan baru' : 'Materi baru'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup form"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={submit}>
        <div className="px-5 pt-5">
          <label htmlFor="composer-title" className="sr-only">
            {isAssignment ? 'Judul penugasan' : 'Judul materi'}
          </label>
          <input
            id="composer-title"
            required
            minLength={2}
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isAssignment ? 'Judul penugasan' : 'Judul materi'}
            className="w-full border-0 bg-transparent font-heading text-[22px] font-bold leading-tight tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <div className="mt-3 h-px bg-rule" />
          <label htmlFor="composer-body" className="sr-only">
            {isAssignment ? 'Instruksi' : 'Deskripsi'}
          </label>
          <textarea
            id="composer-body"
            required
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              isAssignment
                ? 'Tulis instruksi untuk siswa: topik, durasi rekaman, dan aspek yang dinilai.'
                : 'Tulis ringkasan materi, poin kunci, atau tautan referensi.'
            }
            className="mt-3 min-h-28 w-full resize-none border-0 bg-transparent text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between gap-3 pb-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {isAssignment ? 'Instruksi' : 'Deskripsi'}
            </p>
            <span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">{body.length}/5000</span>
          </div>
        </div>

        {isAssignment && (
          <div className="border-t border-rule px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Lampiran & tautan
              </h3>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                Opsional
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <LinkListEditor
                links={links}
                onChange={setLinks}
                withLabel
                addLabel="Tautan"
                urlPlaceholder="https://drive.google.com/…"
              />
              <FileDrop
                accept={ACCEPTED_FILES}
                multiple
                onFiles={(picked) =>
                  setFiles((current) => [
                    ...current,
                    ...picked.filter(
                      (file) => !current.some((entry) => entry.name === file.name && entry.size === file.size),
                    ),
                  ])
                }
                label="Tambah file lampiran"
                hint="PDF, DOCX, PPTX, XLSX, TXT, JPG, PNG, WEBP · maks 25 MB"
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{file.name}</span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}
                      aria-label={`Hapus ${file.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4 border-t border-rule px-5 py-4">
          {isAssignment ? (
            <>
              <div className="min-w-0 flex-1 sm:max-w-64">
                <span className={fieldLabel}>Batas pengumpulan</span>
                <div className="mt-1.5">
                  <DeadlinePicker
                    id="composer-due"
                    label="Batas pengumpulan"
                    value={dueAt}
                    onChange={setDueAt}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="composer-attempts" className={fieldLabel}>
                  Maks attempt
                </label>
                <div className="mt-1.5 flex h-10 w-28 items-center rounded-lg border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setMaxAttempts((current) => Math.max(1, current - 1))}
                    disabled={maxAttempts <= 1}
                    aria-label="Kurangi attempt"
                    className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <input
                    id="composer-attempts"
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={maxAttempts}
                    onChange={(event) =>
                      setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
                    }
                    className="h-full w-full min-w-0 border-0 bg-transparent text-center font-mono text-[13px] tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMaxAttempts((current) => Math.min(10, current + 1))}
                    disabled={maxAttempts >= 10}
                    aria-label="Tambah attempt"
                    className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="min-w-48 flex-1">
              <label htmlFor="composer-topic" className={fieldLabel}>
                Topik (opsional)
              </label>
              <input
                id="composer-topic"
                maxLength={80}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Contoh: Pronunciation"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-secondary/30 px-5 py-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
            {(['draft', 'published'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                aria-pressed={status === value}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  status === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {value === 'draft' ? 'Draft' : 'Publish'}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>

        {error && (
          <p role="alert" className="border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Card>
  )
}
