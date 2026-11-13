'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import type { Assignment, Material } from '@tuturai/domain'
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
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
import { toDeadlineIso } from '@/lib/assignment-deadline'
import { cn } from '@/lib/utils'

export type ComposerKind = 'assignment' | 'material'

const fieldLabel = 'block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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
  const [dueAt, setDueAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const endpoint = isAssignment
        ? `/api/classrooms/${classroomId}/assignments`
        : `/api/classrooms/${classroomId}/materials`
      const payload = isAssignment
        ? { title, instructions: body, dueAt: toDeadlineIso(dueAt), maxAttempts: Number(maxAttempts), status }
        : { title, description: body, topic: topic.trim() || null, status }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'Gagal menyimpan')
      await onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3">
        <div className="flex items-center gap-2">
          {isAssignment ? (
            <ClipboardList className="h-4 w-4 text-primary-deep" aria-hidden="true" />
          ) : (
            <BookOpen className="h-4 w-4 text-primary-deep" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold text-foreground">
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
            className="w-full border-0 bg-transparent font-heading text-xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <div className="mt-3 h-px bg-border" />
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
                ? 'Tulis instruksi untuk siswa — topik, durasi rekaman, dan aspek yang dinilai.'
                : 'Tulis ringkasan materi, poin kunci, atau tautan referensi.'
            }
            className="mt-3 min-h-32 w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-border px-5 py-4">
          {isAssignment ? (
            <>
              <div>
                <label htmlFor="composer-due" className={fieldLabel}>
                  Batas pengumpulan
                </label>
                <input
                  id="composer-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="mt-1.5 h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                />
              </div>
              <div>
                <label htmlFor="composer-attempts" className={fieldLabel}>
                  Maks attempt
                </label>
                <input
                  id="composer-attempts"
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(event.target.value)}
                  className="mt-1.5 h-9 w-20 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-foreground outline-none ring-ring focus-visible:ring-2"
                />
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
                className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
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
                'Simpan'
              )}
            </Button>
          </div>
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
