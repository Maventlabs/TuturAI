export type ActivityDay = {
  /** Calendar day as YYYY-MM-DD (UTC). */
  date: string
  count: number
}

const DAY_MS = 86_400_000

/**
 * Firestore Timestamp, Date, ISO string, or epoch millis → UTC day key.
 * Anything unparseable returns null so a malformed document is skipped rather
 * than counted on the wrong day.
 */
export function toUtcDay(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value).toISOString().slice(0, 10) : null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }

  const candidate = value as { toDate?: () => Date }
  if (typeof candidate.toDate === 'function') {
    const date = candidate.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null
  }

  return null
}

/**
 * Counts day keys into a continuous window ending today, so the heatmap never
 * has to fill gaps on the client and quiet weeks stay visible as empty cells.
 */
export function buildActivitySeries(
  dayKeys: Array<string | null>,
  now = new Date(),
  windowDays = 371,
): ActivityDay[] {
  const counts = new Map<string, number>()
  for (const key of dayKeys) {
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const start = end - (windowDays - 1) * DAY_MS
  const days: ActivityDay[] = []

  for (let time = start; time <= end; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10)
    days.push({ date, count: counts.get(date) ?? 0 })
  }

  return days
}
