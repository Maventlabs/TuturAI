'use client'

import type { Assignment, Submission } from '@tuturai/domain'
import { ArrowUpRight, Check, Circle, Clock3, Undo2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDue } from './format'

export type AssignmentState = 'todo' | 'pending_review' | 'approved' | 'returned'

export function assignmentState(submission: Submission | null): AssignmentState {
  if (!submission) return 'todo'
  switch (submission.status) {
    case 'approved':
      return 'approved'
    case 'returned':
      return 'returned'
    case 'submitted':
    case 'pending_review':
      return 'pending_review'
    default:
      return 'todo'
  }
}

export const STATE_META: Record<
  AssignmentState,
  { label: string; icon: LucideIcon; mark: string; text: string }
> = {
  todo: {
    label: 'Belum dikumpulkan',
    icon: Circle,
    mark: 'border-rule text-muted-foreground/50',
    text: 'text-muted-foreground',
  },
  pending_review: {
    label: 'Menunggu review',
    icon: Clock3,
    mark: 'border-warning/40 bg-warning/10 text-warning',
    text: 'text-warning',
  },
  approved: {
    label: 'Disetujui',
    icon: Check,
    mark: 'border-primary bg-primary text-primary-foreground',
    text: 'text-primary-deep',
  },
  returned: {
    label: 'Dikembalikan',
    icon: Undo2,
    mark: 'border-destructive/40 bg-destructive/10 text-destructive',
    text: 'text-destructive',
  },
}

interface AssignmentRowProps {
  assignment: Assignment
  submission: Submission | null
  onOpen: () => void
}

export function AssignmentRow({ assignment, submission, onOpen }: AssignmentRowProps) {
  const state = assignmentState(submission)
  const meta = STATE_META[state]
  const Icon = meta.icon
  const attempts = submission?.attempt ?? 0
  const canSubmit = state === 'todo' || (state === 'returned' && attempts < assignment.maxAttempts)

  return (
    <li className="border-b border-rule last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-3.5 px-4 py-4 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-5"
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[4px] border',
            meta.mark,
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.4} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[14px] font-medium leading-snug text-foreground">{assignment.title}</span>
            {submission?.isLate && (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-warning">terlambat</span>
            )}
          </span>
          <span className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {assignment.instructions}
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className={meta.text}>{meta.label}</span>
            <span aria-hidden="true" className="text-rule">
              /
            </span>
            <span>{assignment.dueAt ? `Tenggat ${formatDue(assignment.dueAt)}` : 'Tanpa tenggat'}</span>
            <span aria-hidden="true" className="text-rule">
              /
            </span>
            <span className="tabular-nums">
              Attempt {attempts}/{assignment.maxAttempts}
            </span>
          </span>
        </span>

        <span
          className={cn(
            'mt-0.5 flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]',
            canSubmit ? 'text-primary-deep' : 'text-muted-foreground',
          )}
        >
          {canSubmit ? (state === 'returned' ? 'Kirim ulang' : 'Kumpulkan') : 'Lihat'}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </span>
      </button>
    </li>
  )
}
