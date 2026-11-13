import type { TeacherReviewQueueItem } from '@/lib/submissions'

function formatSubmittedAt(value: string | null) {
  if (!value) return 'Waktu tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

interface ReviewQueueProps {
  items: TeacherReviewQueueItem[]
  names: Map<string, string>
}

export function ReviewQueue({ items, names }: ReviewQueueProps) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => (
        <li key={item.submission.id} className="py-2.5 first:pt-0 last:pb-0">
          <p className="truncate text-[13px] font-medium text-foreground">{item.assignment.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {names.get(item.submission.studentId) ?? 'Siswa'} &middot; {item.className}
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
            {formatSubmittedAt(item.submission.submittedAt)}
          </p>
        </li>
      ))}
    </ul>
  )
}
