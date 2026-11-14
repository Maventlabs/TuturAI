'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type ActivityDay = {
  /** Calendar day as YYYY-MM-DD (UTC). */
  date: string
  count: number
}

const DAY_MS = 86_400_000
const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
/** Only three weekday labels are drawn; seven would crowd the rows. */
const WEEKDAY_ROWS = [0, 2, 4]

/** A full year of weeks. Narrow screens drop to half a year so cells stay legible. */
const WEEKS = 53
const WEEKS_COMPACT = 26

const LEVEL_CLASS = ['bg-secondary', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary']

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10)

type Cell = {
  index: number
  date: string
  count: number
  level: number
  col: number
  row: number
  future: boolean
}

type Model = {
  cells: Cell[]
  weeks: number
  months: Array<{ col: number; label: string }>
  total: number
  activeDays: number
  longestStreak: number
  currentStreak: number
}

const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function buildModel(days: ActivityDay[], weeks: number): Model {
  const counts = new Map(days.map((day) => [day.date, day.count]))
  const last = days.length ? toUtc(days[days.length - 1].date) : Date.now()
  const lastWeekday = (new Date(last).getUTCDay() + 6) % 7
  const gridEnd = last + (6 - lastWeekday) * DAY_MS
  const gridStart = gridEnd - (weeks * 7 - 1) * DAY_MS

  const max = days.reduce((value, day) => Math.max(value, day.count), 0)
  const bounds: [number, number, number] = [
    Math.max(1, Math.ceil(max * 0.25)),
    Math.max(2, Math.ceil(max * 0.5)),
    Math.max(3, Math.ceil(max * 0.75)),
  ]

  const cells: Cell[] = []
  for (let index = 0; index < weeks * 7; index++) {
    const time = gridStart + index * DAY_MS
    const date = toIso(time)
    const count = counts.get(date) ?? 0
    const level = count <= 0 ? 0 : count <= bounds[0] ? 1 : count <= bounds[1] ? 2 : count <= bounds[2] ? 3 : 4
    cells.push({ index, date, count, level, col: Math.floor(index / 7), row: index % 7, future: time > last })
  }

  const months: Model['months'] = [{ col: 0, label: monthFormat.format(new Date(toUtc(cells[0].date))) }]
  for (const cell of cells) {
    if (cell.future) continue
    const date = new Date(toUtc(cell.date))
    if (date.getUTCDate() !== 1) continue
    if (cell.col - months[months.length - 1].col < 3) continue
    months.push({ col: cell.col, label: monthFormat.format(date) })
  }

  const past = cells.filter((cell) => !cell.future)
  let longestStreak = 0
  let run = 0
  for (const cell of past) {
    if (cell.count > 0) {
      run += 1
      longestStreak = Math.max(longestStreak, run)
    } else {
      run = 0
    }
  }

  // A streak survives today until the day ends, so an empty today does not
  // break a run that is still alive from yesterday.
  let currentStreak = 0
  for (let index = past.length - 1; index >= 0; index--) {
    if (past[index].count > 0) currentStreak += 1
    else if (index === past.length - 1) continue
    else break
  }

  return {
    cells,
    weeks,
    months,
    total: past.reduce((sum, cell) => sum + cell.count, 0),
    activeDays: past.filter((cell) => cell.count > 0).length,
    longestStreak,
    currentStreak,
  }
}

interface ActivityHeatmapProps {
  days: ActivityDay[] | null
  loading?: boolean
  error?: boolean
}

/**
 * A contribution-style ledger of practice days: one square per day, weeks as
 * columns, four accent tints for how busy a day was. It answers "did I keep the
 * rhythm?" — the week matrix above it answers "what did I do this week?".
 *
 * The grid is sized by the panel, not by a fixed cell width, so a full year
 * always fits without a sideways scroll that hides the older months.
 */
export function ActivityHeatmap({ days, loading = false, error = false }: ActivityHeatmapProps) {
  const [tip, setTip] = useState<{ index: number; left: number; top: number } | null>(null)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [visibleWeeks, setVisibleWeeks] = useState(WEEKS)
  const gridRef = useRef<HTMLDivElement>(null)

  const model = useMemo(() => (days && days.length ? buildModel(days, WEEKS) : null), [days])

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)')
    const sync = () => setVisibleWeeks(query.matches ? WEEKS : WEEKS_COMPACT)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const view = useMemo(() => {
    if (!model) return null
    const startCol = Math.max(0, model.weeks - visibleWeeks)
    const cells = model.cells.filter((cell) => cell.col >= startCol)

    const marks: Array<{ label: string; start: number }> = [
      { label: monthFormat.format(new Date(toUtc(cells[0].date))), start: 0 },
    ]
    for (const cell of cells) {
      if (cell.future) continue
      const date = new Date(toUtc(cell.date))
      if (date.getUTCDate() !== 1) continue
      const start = cell.col - startCol
      if (start - marks[marks.length - 1].start < 3) continue
      marks.push({ label: monthFormat.format(date), start })
    }

    return {
      columns: visibleWeeks,
      cells,
      months: marks.map((mark, index) => ({
        ...mark,
        span: (marks[index + 1]?.start ?? visibleWeeks) - mark.start,
      })),
    }
  }, [model, visibleWeeks])

  const activeIndex = focusIndex ?? (view ? view.cells.length - 1 : 0)
  const tipCell = view && tip ? view.cells[tip.index] : null

  function showTip(index: number, cell: HTMLElement) {
    const width = gridRef.current?.clientWidth ?? 0
    const left = cell.offsetLeft + cell.offsetWidth / 2
    setTip({
      index,
      left: Math.min(Math.max(left, 72), Math.max(width - 72, 72)),
      top: cell.offsetTop,
    })
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!view) return
    const moves: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
      Home: -activeIndex,
      End: view.cells.length - 1 - activeIndex,
    }
    const delta = moves[event.key]
    if (delta === undefined) return
    event.preventDefault()
    const next = Math.min(Math.max(activeIndex + delta, 0), view.cells.length - 1)
    setFocusIndex(next)
    gridRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
  }

  const columns = view?.columns ?? WEEKS
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  } as const

  return (
    <section className="border border-rule bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Ritme latihan
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
          {columns === WEEKS ? '12 bulan' : '6 bulan'}
        </span>
      </header>

      <div className="px-4 py-4">
        {error ? (
          <p role="alert" className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive">
            Aktivitas latihan belum dapat dimuat
          </p>
        ) : loading || !model || !view ? (
          <p role="status" className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Memuat aktivitas
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-[26px] leading-none tabular-nums tracking-[-0.02em] text-foreground">
                  {model.total}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  latihan · {columns === WEEKS ? '12' : '6'} bulan terakhir
                </span>
              </p>
              <dl className="flex items-center gap-5">
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Hari aktif</dt>
                  <dd className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{model.activeDays}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Streak kini</dt>
                  <dd className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{model.currentStreak}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Terpanjang</dt>
                  <dd className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{model.longestStreak}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-5">
              <div className="flex gap-1">
                <div className="w-8 shrink-0" aria-hidden="true" />
                <div className="grid flex-1 gap-[2px]" style={gridStyle} aria-hidden="true">
                  {view.months.map((month) => (
                    <span
                      key={`${month.label}-${month.start}`}
                      style={{ gridColumn: `${month.start + 1} / span ${month.span}` }}
                      className="truncate font-mono text-[9px] uppercase leading-none tracking-[0.08em] text-muted-foreground"
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-1.5 flex gap-1">
                <div className="flex w-8 shrink-0 flex-col gap-[2px]" aria-hidden="true">
                  {WEEKDAY_LABELS.map((label, row) => (
                    <div
                      key={label}
                      className="flex flex-1 items-center font-mono text-[9px] uppercase leading-none tracking-[0.06em] text-muted-foreground"
                    >
                      {WEEKDAY_ROWS.includes(row) ? label : ''}
                    </div>
                  ))}
                </div>

                <div
                  ref={gridRef}
                  role="group"
                  aria-label="Aktivitas latihan harian"
                  onKeyDown={onKeyDown}
                  onMouseLeave={() => setTip(null)}
                  className="relative grid flex-1 gap-[2px]"
                  style={{ ...gridStyle, gridTemplateRows: 'repeat(7, auto)', gridAutoFlow: 'column' }}
                >
                  {view.cells.map((cell) => {
                    if (cell.future) {
                      return <div key={cell.date} className="aspect-square w-full" aria-hidden="true" />
                    }
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        data-index={cell.index}
                        tabIndex={cell.index === activeIndex ? 0 : -1}
                        aria-label={`${cell.count} latihan pada ${dayFormat.format(new Date(toUtc(cell.date)))}`}
                        onMouseEnter={(event) => showTip(cell.index, event.currentTarget)}
                        onFocus={(event) => {
                          setFocusIndex(cell.index)
                          showTip(cell.index, event.currentTarget)
                        }}
                        onBlur={() => setTip(null)}
                        className={cn(
                          'aspect-square w-full rounded-[2px] outline-none transition-[box-shadow] duration-150',
                          LEVEL_CLASS[cell.level],
                          'hover:ring-1 hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                      />
                    )
                  })}

                  {tip && tipCell && (
                    <div
                      role="presentation"
                      style={{ left: tip.left, top: tip.top }}
                      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap border border-ink-foreground/10 bg-ink-deep px-2 py-1 font-mono text-[10px] leading-none text-ink-foreground"
                    >
                      <span className="tabular-nums">{tipCell.count} latihan</span>
                      <span className="mx-1.5 text-ink-muted">·</span>
                      <span className="text-ink-muted">{dayFormat.format(new Date(toUtc(tipCell.date)))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {model.total === 0
                  ? 'Belum ada latihan tercatat. Satu sesi mengisi kotak pertama.'
                  : `${view.cells.filter((cell) => !cell.future).length} hari terakhir`}
              </p>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Sedikit</span>
                {LEVEL_CLASS.map((level) => (
                  <span key={level} className={cn('size-3 rounded-[2px]', level)} aria-hidden="true" />
                ))}
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Banyak</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
