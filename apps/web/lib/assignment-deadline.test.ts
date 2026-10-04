import { describe, expect, it } from 'vitest'
import { toDeadlineIso } from './assignment-deadline'

describe('assignment deadline conversion', () => {
  it('turns a datetime-local wall clock into an offset-aware instant', () => {
    const iso = toDeadlineIso('2026-10-04T14:23')
    expect(iso).toBe(new Date('2026-10-04T14:23').toISOString())
    // The whole point: the wire format must carry an explicit offset so a UTC
    // server cannot shift a teacher's local deadline.
    expect(iso).toMatch(/Z$/)
  })

  it('resolves to the same instant the teacher entered, regardless of reader timezone', () => {
    const entered = '2026-10-04T14:23'
    const iso = toDeadlineIso(entered) as string
    // Any reader, in any timezone, derives the identical instant from the
    // offset-aware value...
    expect(new Date(iso).getTime()).toBe(new Date(entered).getTime())
    // ...whereas the naive value is only correct for a reader sharing the
    // teacher's offset, which is exactly the defect being guarded.
    expect(iso).not.toBe(entered)
  })

  it('treats an empty deadline as no deadline', () => {
    expect(toDeadlineIso('')).toBeNull()
    expect(toDeadlineIso('   ')).toBeNull()
    expect(toDeadlineIso(null)).toBeNull()
    expect(toDeadlineIso(undefined)).toBeNull()
  })

  it('rejects an unparseable deadline instead of inventing an instant', () => {
    expect(toDeadlineIso('not-a-date')).toBeNull()
  })

  it('keeps a past deadline in the past', () => {
    const past = new Date(Date.now() - 2 * 60_000)
    const localWallClock = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}T${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}`
    const iso = toDeadlineIso(localWallClock) as string
    // Server-side late detection compares `now` against this instant; a deadline
    // entered as "two minutes ago" must still read as two minutes ago.
    expect(new Date(iso).getTime()).toBeLessThan(Date.now())
  })
})