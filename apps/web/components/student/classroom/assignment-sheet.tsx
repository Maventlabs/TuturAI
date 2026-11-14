'use client'

import { useState } from 'react'
import type { Assignment, Submission } from '@tuturai/domain'
import { ArrowUpRight, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { assignmentState, STATE_META } from './assignment-row'
import { formatDue } from './format'

const ACCEPTED_FILES = '.pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

interface AssignmentSheetProps {
  assignment: Assignment | null
  submission: Submission | null
  classroomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (assignment: Assignment, file: File | null) => void
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

  // Clearing on close keeps a file picked for one assignment from leaking into
  // the next one, without an effect that would re-render on every open change.
  function handleOpenChange(next: boolean) {
    if (!next) setFile(null)
    onOpenChange(next)
  }

  if (!assignment) return null

  const state = assignmentState(submission)
  const meta = STATE_META[state]
  const attempts = submission?.attempt ?? 0
  const attemptsRemain = attempts < assignment.maxAttempts
  const canSubmit = state === 'todo' || (state === 'returned' && attemptsRemain)
  const submitLabel = state === 'returned' ? 'Kirim ulang' : 'Kumpulkan tugas'

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

          {assignment.attachments?.length ? (
            <section className="border-t border-rule px-5 py-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Lampiran guru
              </h3>
              <ul className="mt-2 space-y-1.5">
                {assignment.attachments.map((attachment) => (
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
              </ul>
            </section>
          ) : null}

          {submission?.files?.length ? (
            <section className="border-t border-rule px-5 py-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                File terkirim
              </h3>
              <ul className="mt-2 space-y-1.5">
                {submission.files.map((submitted) => (
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
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Lampiran pengumpulan
              </h3>
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 border border-dashed border-border bg-secondary/40 px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-secondary has-[:focus-visible]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30">
                <span className="flex min-w-0 items-center gap-2">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-[12.5px] text-foreground">
                    {file ? file.name : 'Pilih file (opsional)'}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-primary-deep">
                  Pilih
                </span>
                <input
                  type="file"
                  accept={ACCEPTED_FILES}
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                PDF, DOCX, PPTX, XLSX, TXT, JPG, PNG, WEBP
              </p>
            </section>
          )}

          {error && (
            <p
              role="alert"
              className="mx-5 my-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] leading-relaxed text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="border-t border-rule px-5 py-4">
          {canSubmit ? (
            <>
              <Button
                onClick={() => onSubmit(assignment, file)}
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
