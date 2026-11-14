const DAY_MS = 86_400_000

const dueFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

// Deadlines are school dates, so they are read in Jakarta time on both the
// server and the client — otherwise a 23:59 WIB deadline renders as the next
// day for anyone whose machine sits in another timezone.
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dayNumber = (date: Date) => Date.parse(`${dayKeyFormat.format(date)}T00:00:00Z`) / DAY_MS

export function formatDue(iso: string) {
  return dueFormat.format(new Date(iso))
}

/** Whole calendar days until the deadline; negative means overdue. */
export function daysUntil(iso: string, now = new Date()) {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return null
  return dayNumber(due) - dayNumber(now)
}

export function relativeDue(iso: string, now = new Date()) {
  const days = daysUntil(iso, now)
  if (days === null) return null
  if (days === 0) return 'hari ini'
  if (days === 1) return 'besok'
  if (days > 1) return `${days} hari lagi`
  if (days === -1) return 'lewat 1 hari'
  return `lewat ${Math.abs(days)} hari`
}
