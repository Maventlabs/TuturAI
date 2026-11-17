'use client'

import { useState } from 'react'
import type { Assignment, Submission } from '@tuturai/domain'
import { ArrowUpRight, Link2, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FileDrop } from '@/components/shared/file-drop'
import {
  isHttpUrl,
  LinkListEditor,
  toLinkPayload,
  type DraftLink,
} from '@/components/shared/link-list-editor'
import { cn } from '@/lib/utils'
import { assignmentState, STATE_META } from './assignment-row'
import { formatDue } from './format'

const ACCEPTED_FILES = '.pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AssignmentSheetProps {
  assignment: Assignment | null
  submission: Submission | null
  classroomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (assignment: Assignment, file: File | null, links: Array<{ label: string; url: string }>) => void
  submitting: boolean
  error: string | null
}

export function AssignmentSheet({
  assignment,
  submission,
  classroomName,
  open,
  onOpenChange,
  onSubmit,
  submitting,
  error,
}: AssignmentSheetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [links, setLinks] = useState<DraftLink[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  // Clearing on close keeps a file picked for one assignment from leaking into
  // the next one, without an effect that would re-render on every open change.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setFile(null)
      setLinks([])
      setFormError(null)
    }
    onOpenChange(next)
  }

  if (!assignment) return null

  const state = assignmentState(submission)
  const meta = STATE_META[state]
  const attempts = submission?.attempt ?? 0
  const attemptsRemain = attempts < assignment.maxAttempts
  const canSubmit = state === 'todo' || (state === 'returned' && attemptsRemain)
  const submitLabel = state === 'returned' ? 'Kirim ulang' : 'Kumpulkan tugas'
  const teacherLinks = assignment.links ?? []
  const submittedLinks = submission?.links ?? []

  function handleSubmit() {
    const invalid = links.find((link) => link.url.trim().length > 0 && !isHttpUrl(link.url))
    if (invalid) {
      setFormError('Tautan harus diawali http:// atau https://')
      return
    }
    setFormError(null)
    onSubmit(assignment as Assignment, file, toLinkPayload(links))
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-rule px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{classroomName}</p>
          <SheetTitle className="mt-1 text-[17px] leading-snug">{assignment.title}</SheetTitle>
          <SheetDescription className="sr-only">Detail tugas dan formulir pengumpulan</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <dl className="grid grid-cols-3 gap-px bg-rule">
            <div className="bg-card px-4 py-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Tenggat</dt>
              <dd className="mt-1 text-[12.5px] leading-snug text-foreground">
                {assignment.dueAt ? formatDue(assignment.dueAt) : 'Tanpa tenggat'}
              </dd>
            </div>
            <div className="bg-card px-4 py-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Attempt</dt>
              <dd className="mt-1 font-mono text-[12.5px] tabular-nums leading-snug text-foreground">
                {attempts}/{assignment.maxAttempts}
              </dd>
            </div>
            <div className="bg-card px-4 py-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Status</dt>
              <dd className={cn('mt-1 text-[12.5px] leading-snug', meta.text)}>{meta.label}</dd>
            </div>
          </dl>

          <section className="border-t border-rule px-5 py-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Instruksi</h3>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
              {assignment.instructions}
            </p>
          </section>

          {assignment.attachments?.length || teacherLinks.length ? (
            <section className="border-t border-rule px-5 py-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Lampiran & tautan guru
              </h3>
              <ul className="mt-2 space-y-1.5">
                {assignment.attachments?.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-2 text-[12.5px]">
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {attachment.webViewLink ? (
                      <a
                        href={attachment.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary-deep underline underline-offset-2"
                      >
                        {attachment.name}
                      </a>
                    ) : (
                      <span className="truncate text-foreground">{attachment.name}</span>
                    )}
                  </li>
                ))}
                {teacherLinks.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 text-[12.5px]">
                    <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-primary-deep underline underline-offset-2"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {submission?.files?.length || submittedLinks.length ? (
            <section className="border-t border-rule px-5 py-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Yang sudah kamu kirim
              </h3>
              <ul className="mt-2 space-y-1.5">
                {submission?.files?.map((submitted) => (
                  <li key={submitted.id} className="flex items-center gap-2 text-[12.5px]">
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {submitted.webViewLink ? (
                      <a
                        href={submitted.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary-deep underline underline-offset-2"
                      >
                        {submitted.name}
                      </a>
                    ) : (
                      <span className="truncate text-foreground">{submitted.name}</span>
                    )}
                  </li>
                ))}
                {submittedLinks.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 text-[12.5px]">
                    <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-primary-deep underline underline-offset-2"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {submission?.teacherFeedback ? (
            <section className="border-t border-rule px-5 py-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Catatan guru
              </h3>
              <p className="mt-2 border-l-2 border-primary/30 pl-3 text-[13px] leading-relaxed text-foreground">
                {submission.teacherFeedback}
              </p>
            </section>
          ) : null}

          {canSubmit && (
            <section className="border-t border-rule px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Pengumpulan
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                  File atau tautan
                </span>
              </div>

              <div className="mt-2 space-y-2">
                {file ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{file.name}</span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      aria-label={`Hapus ${file.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <FileDrop
                    accept={ACCEPTED_FILES}
                    onFiles={(picked) => setFile(picked[0] ?? null)}
                    label="Pilih file dari perangkat"
                    hint="PDF, DOCX, PPTX, XLSX, TXT, JPG, PNG, WEBP · 25 MB"
                  />
                )}

                <LinkListEditor
                  links={links}
                  onChange={setLinks}
                  addLabel="Kirim tautan"
                  urlPlaceholder="https://drive.google.com/…"
                />
              </div>
            </section>
          )}

          {(formError || error) && (
            <p
              role="alert"
              className="mx-5 my-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] leading-relaxed text-destructive"
            >
              {formError ?? error}
            </p>
          )}
        </div>

        <SheetFooter className="border-t border-rule px-5 py-4">
          {canSubmit ? (
            <>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-10 w-full justify-between rounded-full bg-ink-deep px-4 text-[13px] font-semibold text-ink-foreground hover:bg-ink-deep/90"
              >
                {submitting ? 'Mengirim…' : submitLabel}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <p className="text-center font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                Attempt {attempts + 1} dari {assignment.maxAttempts}
              </p>
            </>
          ) : (
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {state === 'approved'
                ? 'Tugas sudah disetujui guru'
                : state === 'pending_review'
                  ? 'Menunggu review guru'
                  : 'Tidak ada attempt tersisa'}
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
