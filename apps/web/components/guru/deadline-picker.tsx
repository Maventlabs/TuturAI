'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const PANEL_WIDTH = 312
const PANEL_HEIGHT = 344

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function formatValue(date: Date) {
  const day = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  return `${day} · ${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')}`
}

function withTime(day: Date, hours: number, minutes: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0)
}

/**
 * A calendar popover instead of `<input type="datetime-local">`: the native
 * control renders an OS picker that covers the composer and cannot be styled,
 * and its wall-clock string has to be re-interpreted on the server. This emits
 * a real `Date`, so the deadline leaves the client as an unambiguous instant.
 *
 * The panel is portalled because the composer card clips its overflow, which
 * would cut the calendar off at the card edge.
 */
export function DeadlinePicker({
  id,
  label,
  value,
  onChange,
}: {
  id?: string
  label: string
  value: Date | null
  onChange: (next: Date | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ?? new Date()))
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8)
      const below = rect.bottom + 8
      const top = below + PANEL_HEIGHT > window.innerHeight ? Math.max(8, rect.top - PANEL_HEIGHT - 8) : below
      setPosition({ top, left })
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    updatePosition()
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const offset = (new Date(year, month, 1).getDay() + 6) % 7
    const total = new Date(year, month + 1, 0).getDate()
    const result: Array<{ date: Date; inMonth: boolean }> = []
    for (let index = offset; index > 0; index -= 1) {
      result.push({ date: new Date(year, month, 1 - index), inMonth: false })
    }
    for (let day = 1; day <= total; day += 1) {
      result.push({ date: new Date(year, month, day), inMonth: true })
    }
    while (result.length % 7 !== 0) {
      result.push({ date: new Date(year, month + 1, result.length - offset - total + 1), inMonth: false })
    }
    return result
  }, [viewMonth])

  const hours = value?.getHours() ?? 23
  const minutes = value?.getMinutes() ?? 59
  const today = new Date()

  function selectDay(day: Date) {
    onChange(withTime(day, hours, minutes))
  }

  function selectTime(nextHours: number, nextMinutes: number) {
    onChange(withTime(value ?? today, nextHours, nextMinutes))
  }

  function applyPreset(days: number) {
    const target = withTime(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days), 23, 59)
    onChange(target)
    setViewMonth(startOfMonth(target))
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => {
          setViewMonth(startOfMonth(value ?? new Date()))
          setOpen((current) => !current)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value ? formatValue(value) : 'tanpa tenggat'}`}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg border bg-background px-3 text-left text-[13px] outline-none transition-colors',
          open ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-primary/40',
        )}
      >
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={cn('flex-1 truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
          {value ? formatValue(value) : 'Tanpa tenggat'}
        </span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Pilih batas pengumpulan"
            style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
            className="fixed z-50 rounded-xl border border-border bg-popover p-3 shadow-lg shadow-foreground/10"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                aria-label="Bulan sebelumnya"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
                {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </p>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                aria-label="Bulan berikutnya"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {weekday}
                </span>
              ))}
              {cells.map((cell) => {
                const selected = value ? sameDay(cell.date, value) : false
                const isToday = sameDay(cell.date, today)
                return (
                  <button
                    key={cell.date.toISOString()}
                    type="button"
                    onClick={() => selectDay(cell.date)}
                    aria-pressed={selected}
                    aria-label={new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(cell.date)}
                    className={cn(
                      'flex h-8 items-center justify-center rounded-md text-[12px] tabular-nums transition-colors',
                      selected
                        ? 'bg-ink-deep font-semibold text-ink-foreground'
                        : cell.inMonth
                          ? 'text-foreground hover:bg-secondary'
                          : 'text-muted-foreground/50 hover:bg-secondary/60',
                      isToday && !selected && 'ring-1 ring-inset ring-primary/40',
                    )}
                  >
                    {cell.date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Jam</span>
              <select
                value={hours}
                onChange={(event) => selectTime(Number(event.target.value), minutes)}
                aria-label="Jam batas pengumpulan"
                className="h-8 rounded-md border border-border bg-background px-1.5 font-mono text-[12px] tabular-nums text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="font-mono text-[12px] text-muted-foreground">:</span>
              <select
                value={minutes}
                onChange={(event) => selectTime(hours, Number(event.target.value))}
                aria-label="Menit batas pengumpulan"
                className="h-8 rounded-md border border-border bg-background px-1.5 font-mono text-[12px] tabular-nums text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                {MINUTE_STEPS.map((minute) => (
                  <option key={minute} value={minute}>
                    {String(minute).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-destructive"
              >
                Hapus
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {[
                { label: 'Hari ini', days: 0 },
                { label: 'Besok', days: 1 },
                { label: '3 hari', days: 3 },
                { label: '1 minggu', days: 7 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
