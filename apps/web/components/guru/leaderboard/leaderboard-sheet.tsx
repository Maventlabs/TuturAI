'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Panel, EmptyNote } from '@/components/guru/overview/panel'
import { ReadoutStrip, type Readout } from '@/components/guru/overview/readout-strip'
import { cn } from '@/lib/utils'

export type LeaderboardRow = {
  studentId: string
  name: string
  classId: string
  className: string
  xp: number
  speakingScore: number | null
  rank: number
}

export type ClassroomFilter = { id: string; name: string }

const xpFormat = new Intl.NumberFormat('id-ID')
const compactFormat = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })

function formatXp(value: number) {
  return xpFormat.format(value)
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'S'
  )
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

// Podium columns are a bar chart: height encodes XP against the leader, with a
// floor so a near-zero score still reads as a column instead of a hairline.
const COLUMN_FLOOR = 36
const COLUMN_SPAN = 64

function columnHeight(xp: number, topXp: number) {
  if (topXp <= 0) return COLUMN_FLOOR
  return COLUMN_FLOOR + Math.round((Math.max(xp, 0) / topXp) * COLUMN_SPAN)
}

function buildLead(input: {
  classroomCount: number
  leader: LeaderboardRow | undefined
  runnerUp: LeaderboardRow | undefined
}) {
  const { classroomCount, leader, runnerUp } = input

  if (classroomCount === 0) {
    return 'Papan ini terisi dari XP siswa di kelas yang Anda kelola. Belum ada siswa yang bisa diperingkatkan.'
  }
  if (!leader) {
    return 'Kelas yang dipilih belum memiliki siswa, jadi belum ada peringkat yang bisa ditampilkan.'
  }
  if (!runnerUp) {
    return `${leader.name} satu-satunya siswa di papan ini dengan ${formatXp(leader.xp)} XP.`
  }
  return `${leader.name} memimpin dengan ${formatXp(leader.xp)} XP, ${formatXp(leader.xp - runnerUp.xp)} XP di atas peringkat kedua.`
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// Ghost rows mirror the real ledger columns so the empty state reads as an
// empty ranking rather than a floating message.
function EmptyLanes() {
  return (
    <div aria-hidden className="divide-y divide-rule border-y border-rule">
      {[1, 2, 3].map((lane) => (
        <div key={lane} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <span className="w-7 shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground/30">{lane}</span>
          <span className="h-8 w-8 shrink-0 rounded-full border border-dashed border-border" />
          <span className="h-2 w-full max-w-[180px] flex-1 border border-dashed border-border" />
          <span className="hidden h-1 w-24 shrink-0 border border-dashed border-border sm:block lg:w-40" />
          <span className="h-2 w-12 shrink-0 border border-dashed border-border" />
        </div>
      ))}
    </div>
  )
}

function LoadingLedger() {
  return (
    <div role="status" aria-busy="true" aria-label="Memuat klasemen">
      <p className="border-b border-rule px-4 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60 sm:px-5">
        Memuat klasemen
      </p>
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-3 border-b border-rule px-4 py-3 last:border-b-0 sm:gap-4 sm:px-5">
          <span className="h-3 w-5 animate-pulse bg-rule" />
          <span className="h-8 w-8 animate-pulse rounded-full bg-rule" />
          <span className="h-3 flex-1 animate-pulse bg-rule" />
          <span className="hidden h-1 w-24 animate-pulse bg-rule sm:block lg:w-40" />
          <span className="h-3 w-14 animate-pulse bg-rule" />
        </div>
      ))}
    </div>
  )
}

interface LeaderboardSheetProps {
  rows: LeaderboardRow[]
  classrooms: ClassroomFilter[]
  filter: string
  onFilterChange: (value: string) => void
  loading: boolean
  error: string | null
  onRetry: () => void
  today: string | null
}

export function LeaderboardSheet({
  rows,
  classrooms,
  filter,
  onFilterChange,
  loading,
  error,
  onRetry,
  today,
}: LeaderboardSheetProps) {
  const filtered = filter === 'all' ? rows : rows.filter((row) => row.className === filter)
  const podium = filtered.slice(0, 3)
  const rest = filtered.slice(3)
  const leader = filtered[0]
  const runnerUp = filtered[1]
  const topXp = leader?.xp ?? 0
  const scored = filtered.filter((row) => row.speakingScore !== null)
  const speakingAverage = scored.length
    ? Math.round(scored.reduce((total, row) => total + (row.speakingScore ?? 0), 0) / scored.length)
    : null
  const classCount = filter === 'all' ? classrooms.length : 1
  const medianXp = median(filtered.map((row) => row.xp))

  const readouts: Readout[] = [
    {
      label: 'Kelas',
      value: String(classCount),
      note: filter === 'all' ? 'semua kelas' : 'filter aktif',
    },
    {
      label: 'Siswa',
      value: String(filtered.length),
      note: 'di papan',
    },
    {
      label: 'XP tertinggi',
      value: leader ? compactFormat.format(leader.xp) : '—',
      note: 'tertinggi di papan',
    },
    {
      label: 'Median XP',
      value: medianXp === null ? '—' : compactFormat.format(medianXp),
      note: 'seluruh siswa',
    },
    {
      label: 'Speaking',
      value: speakingAverage === null ? '—' : String(speakingAverage),
      unit: speakingAverage === null ? undefined : '%',
      note: `${scored.length} siswa dinilai`,
    },
  ]

  const lead = buildLead({ classroomCount: classrooms.length, leader, runnerUp })
  const gap = podium.length > 1 ? podium[0].xp - podium[1].xp : null
  const podiumDisplay = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardRow[]

  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[10px] uppercase tracking-[0.12em] underline underline-offset-4"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-rule px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Klasemen XP{today ? ` · ${today}` : ''}
              </p>
              <h1 className="mt-3 font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
                Papan Peringkat
              </h1>
              <p className="mt-2 max-w-[64ch] text-pretty text-[13px] leading-relaxed text-muted-foreground">
                {loading ? 'Membaca XP siswa dari kelas Anda…' : lead}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">Filter kelas</p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={filter === 'all'} onClick={() => onFilterChange('all')}>
                  Semua Kelas
                </FilterChip>
                {classrooms.map((classroom) => (
                  <FilterChip
                    key={classroom.id}
                    active={filter === classroom.name}
                    onClick={() => onFilterChange(classroom.name)}
                  >
                    {classroom.name}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ReadoutStrip items={readouts} />

        {loading ? (
          <div className="border-t border-rule">
            <LoadingLedger />
          </div>
        ) : classrooms.length === 0 ? (
          <div className="border-t border-rule">
            <EmptyLanes />
            <div className="px-4 py-6 sm:px-5">
              <EmptyNote
                title="Belum ada siswa untuk diperingkatkan"
                description="Peringkat terbentuk dari XP siswa yang tergabung di kelas Anda. Buat kelas, undang siswa, lalu papan ini terisi sendiri dari data nyata."
                action={
                  <Link
                    href="/guru/kelas"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                  >
                    Buat kelas <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                }
              />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-t border-rule">
            <EmptyLanes />
            <div className="px-4 py-6 sm:px-5">
              <EmptyNote
                title="Kelas ini belum punya siswa"
                description="Peringkat muncul setelah siswa bergabung dan mengumpulkan XP dari latihan."
                action={
                  <Link
                    href="/guru/siswa"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
                  >
                    Kelola siswa <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="border-t border-rule bg-ink-deep px-4 pb-5 pt-4 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Puncak klasemen</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted/70">
                  {gap === null ? 'Peserta tunggal' : `Selisih #1–#2 · ${formatXp(gap)} XP`}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-ink-foreground/10 border-b border-ink-foreground/15">
                {podiumDisplay.map((row) => {
                  const isLeader = row.rank === 1
                  return (
                    <div
                      key={`${row.classId}-${row.studentId}`}
                      className="flex min-w-0 flex-col items-center justify-end px-2"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border font-mono text-[11px] font-medium sm:h-12 sm:w-12 sm:text-[13px]',
                          isLeader ? 'border-brand text-brand' : 'border-ink-muted/40 text-ink-foreground',
                        )}
                      >
                        {initials(row.name)}
                      </div>
                      <p className="mt-2 w-full truncate text-center text-[12px] font-medium text-ink-foreground sm:text-[13px]">
                        {row.name}
                      </p>
                      <p className="w-full truncate text-center font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">
                        {row.className}
                      </p>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-ink-foreground sm:text-[12px]">
                        {formatXp(row.xp)}
                        <span className="ml-1 text-[9px] uppercase tracking-[0.1em] text-ink-muted">XP</span>
                      </p>
                      <div
                        style={{ height: columnHeight(row.xp, topXp) }}
                        className={cn(
                          'mt-3 flex w-full items-center justify-center border-t-2',
                          isLeader ? 'border-brand bg-brand' : 'border-ink-muted/30 bg-ink-foreground/10',
                        )}
                      >
                        <span
                          className={cn(
                            'font-mono text-[24px] font-medium leading-none tabular-nums sm:text-[30px]',
                            isLeader ? 'text-ink-deep' : 'text-ink-muted',
                          )}
                        >
                          {row.rank}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Panel label="Klasemen" meta={`${filtered.length} siswa`} bodyClassName="p-0">
              <div className="flex items-center gap-3 border-b border-rule px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60 sm:gap-4 sm:px-5">
                <span className="w-7 shrink-0">#</span>
                <span className="w-8 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">Siswa</span>
                <span className="hidden w-24 shrink-0 sm:block lg:w-40">XP relatif</span>
                <span className="w-20 shrink-0 text-right">XP</span>
                <span className="w-12 shrink-0 text-right">Speaking</span>
              </div>

              {rest.length === 0 ? (
                <div className="px-4 py-6 sm:px-5">
                  <EmptyNote
                    title="Semua siswa sudah tampil di puncak"
                    description="Klasemen memanjang otomatis begitu ada siswa keempat pada filter ini."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-rule">
                  {rest.map((row) => {
                    const share = topXp > 0 ? Math.max(2, Math.round((row.xp / topXp) * 100)) : 0
                    return (
                      <li
                        key={`${row.classId}-${row.studentId}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-5"
                      >
                        <span className="w-7 shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">
                          {row.rank}
                        </span>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-foreground/70">
                          {initials(row.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">{row.name}</p>
                          <p className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                            {row.className}
                          </p>
                        </div>
                        <div className="hidden w-24 shrink-0 sm:block lg:w-40">
                          <div className="h-1 w-full bg-rule">
                            <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                          </div>
                        </div>
                        <div className="w-20 shrink-0 text-right font-mono text-[12px] tabular-nums text-foreground">
                          {formatXp(row.xp)}
                          <span className="ml-1 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">XP</span>
                        </div>
                        <div className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                          {row.speakingScore === null ? '—' : `${row.speakingScore}%`}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>

      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50">
        Sumber: Firestore &middot; XP pengguna, assessment speaking, keanggotaan kelas
      </p>
    </div>
  )
}
