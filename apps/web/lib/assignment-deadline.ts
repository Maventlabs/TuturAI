/**
 * Assignment deadline conversion.
 *
 * `<input type="datetime-local">` yields a wall-clock string with no timezone
 * designator (for example `2026-10-04T14:23`). Sending that value as-is makes
 * every consumer guess: `new Date('2026-10-04T14:23')` is interpreted as local
 * time, so the UTC API host reads it as 14:23 **UTC** while the teacher meant
 * 14:23 in their own timezone. For an Indonesian teacher that silently moves
 * every deadline 7 hours later and flips the derived late/on-time state.
 *
 * The browser does know the teacher's timezone, so the value is converted to an
 * offset-aware ISO instant before it leaves the client.
 */
export function toDeadlineIso(localValue: string | null | undefined): string | null {
  const trimmed = (localValue ?? '').trim()
  if (!trimmed) return null

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null

  // `toISOString()` always carries an explicit `Z`, so the server can no longer
  // reinterpret the teacher's wall clock in the host timezone.
  return parsed.toISOString()
}