import type { SubmissionStatus } from '@tuturai/domain'

export type SubmissionTone = 'missing' | 'progress' | 'pending' | 'approved' | 'returned'

export function submissionStatusMeta(status: SubmissionStatus | null): { label: string; tone: SubmissionTone } {
  if (!status) return { label: 'Belum mengumpulkan', tone: 'missing' }
  switch (status) {
    case 'assigned':
    case 'in_progress':
      return { label: 'Dikerjakan', tone: 'progress' }
    case 'submitted':
    case 'pending_review':
      return { label: 'Menunggu review', tone: 'pending' }
    case 'approved':
      return { label: 'Disetujui', tone: 'approved' }
    case 'returned':
      return { label: 'Dikembalikan', tone: 'returned' }
  }
}

export const submissionToneClass: Record<SubmissionTone, string> = {
  missing: 'bg-secondary text-muted-foreground',
  progress: 'bg-primary/10 text-primary-deep',
  pending: 'bg-brand/20 text-brand-foreground',
  approved: 'bg-success/15 text-success',
  returned: 'bg-destructive/10 text-destructive',
}
