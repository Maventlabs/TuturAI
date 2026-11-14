'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Classroom } from '@tuturai/domain'
import { ArrowDown, ArrowUp, ArrowUpDown, Flame, Search, Users, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'speakingScore' | 'level' | 'streak'

type ClassroomMember = {
  studentId: string
  name: string
  email: string | null
  joinedAt: string
  level: number | null
  streak: number | null
  speakingScore: number | null
}

type StudentRow = ClassroomMember & {
  classId: string
  className: string
}

type ApiResponse<T> = { data: T }

export default function StudentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('speakingScore')
  const [asc, setAsc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // The topbar search navigates here with ?search=, which is browser-only state.
  // Reading it after mount keeps the server and client markup identical.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('search')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) setQuery(initial)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudents() {
      setLoading(true)
      setError(null)

      try {
        const classroomsResponse = await fetch('/api/classrooms', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const classroomsPayload = await classroomsResponse.json() as ApiResponse<Classroom[]> & { error?: { message?: string } }
        if (!classroomsResponse.ok) {
          throw new Error(classroomsPayload.error?.message ?? 'Gagal memuat classroom')
        }

        const loadedClassrooms = classroomsPayload.data
        const memberResponses = await Promise.all(
          loadedClassrooms.map(async (classroom) => {
            const response = await fetch(`/api/classrooms/${classroom.id}/members`, {
              cache: 'no-store',
              signal: controller.signal,
            })
            const payload = await response.json() as ApiResponse<ClassroomMember[]> & { error?: { message?: string } }
            if (!response.ok) {
              throw new Error(payload.error?.message ?? `Gagal memuat siswa dari ${classroom.name}`)
            }
            return payload.data.map((member) => ({
              ...member,
              classId: classroom.id,
              className: classroom.name,
            }))
          }),
        )

        setClassrooms(loadedClassrooms)
        setStudents(memberResponses.flat())
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat daftar siswa')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadStudents()
    return () => controller.abort()
  }, [])

  const rows = useMemo(() => {
    let filtered = students.filter((student) =>
      student.name.toLowerCase().includes(query.toLowerCase()),
    )
    if (classFilter !== 'all') filtered = filtered.filter((student) => student.className === classFilter)

    return [...filtered].sort((left, right) => {
      if (sortKey === 'name') {
        const result = left.name.localeCompare(right.name)
        return asc ? result : -result
      }

      const leftValue = sortKey === 'speakingScore' ? left.speakingScore : sortKey === 'level' ? left.level : left.streak
      const rightValue = sortKey === 'speakingScore' ? right.speakingScore : sortKey === 'level' ? right.level : right.streak
      if (leftValue === null && rightValue === null) return left.name.localeCompare(right.name)
      if (leftValue === null) return 1
      if (rightValue === null) return -1
      const result = rightValue - leftValue
      return asc ? -result : result
    })
  }, [query, classFilter, sortKey, asc, students])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((current) => !current)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  const hasFilter = query.trim().length > 0 || classFilter !== 'all'

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Daftar Siswa"
        description="Cari, filter, dan urutkan siswa berdasarkan data classroom."
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama siswa..."
            aria-label="Cari nama siswa"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={classFilter} onValueChange={(value) => setClassFilter(value ?? 'all')}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter kelas">
            <span className="flex-1 truncate text-left">
              {classFilter === 'all' ? 'Semua kelas' : classFilter}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kelas</SelectItem>
            {classrooms.map((classroom) => (
              <SelectItem key={classroom.id} value={classroom.name}>
                {classroom.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FadeIn>
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground" role="status" aria-busy="true">
              Memuat daftar siswa...
            </div>
          ) : classrooms.length === 0 ? (
            <EmptyState
              title="Belum ada classroom"
              description="Buat classroom lebih dulu, lalu bagikan kode join ke siswa Anda."
              action={<Button asChild><Link href="/guru/kelas">Buka Kelas Saya</Link></Button>}
            />
          ) : students.length === 0 ? (
            <EmptyState
              title="Belum ada siswa bergabung"
              description="Siswa akan muncul di sini setelah mereka memasukkan kode join classroom Anda."
              action={<Button asChild><Link href="/guru/kelas">Bagikan kode join</Link></Button>}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Tidak ada siswa yang cocok"
              description="Coba kata kunci lain atau ubah filter kelas."
              action={
                <Button
                  variant="outline"
                  onClick={() => { setQuery(''); setClassFilter('all') }}
                >
                  Reset filter
                </Button>
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">
                        <SortBtn label="Siswa" active={sortKey === 'name'} asc={asc} onClick={() => toggleSort('name')} />
                      </th>
                      <th className="px-4 py-3 font-semibold">Kelas</th>
                      <th className="px-4 py-3 font-semibold">
                        <SortBtn label="Skor Speaking" active={sortKey === 'speakingScore'} asc={asc} onClick={() => toggleSort('speakingScore')} />
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        <SortBtn label="Level" active={sortKey === 'level'} asc={asc} onClick={() => toggleSort('level')} />
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        <SortBtn label="Streak" active={sortKey === 'streak'} asc={asc} onClick={() => toggleSort('streak')} />
                      </th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((student) => <StudentTableRow key={`${student.classId}:${student.studentId}`} student={student} />)}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {rows.map((student) => <StudentMobileRow key={`${student.classId}:${student.studentId}`} student={student} />)}
              </div>

              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {rows.length} dari {students.length} siswa
                </span>
                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setClassFilter('all') }}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Reset filter
                  </button>
                )}
              </div>
            </>
          )}
        </Card>
      </FadeIn>
    </div>
  )
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center" role="status">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="font-heading text-sm font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-pretty text-sm text-muted-foreground">{description}</p>
      <div className="mt-2">{action}</div>
    </div>
  )
}

function StudentTableRow({ student }: { student: StudentRow }) {
  return (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-secondary/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <StudentAvatar name={student.name} />
          <div className="min-w-0">
            <Link
              href={`/guru/siswa/${encodeURIComponent(student.studentId)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {student.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{student.email ?? 'Email tidak tersedia'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex max-w-[180px] truncate rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
          {student.className}
        </span>
      </td>
      <td className="px-4 py-3"><ScoreCell score={student.speakingScore} /></td>
      <td className="px-4 py-3"><MetricCell value={student.level} /></td>
      <td className="px-4 py-3"><MetricCell value={student.streak} icon={<Flame className="h-3.5 w-3.5 text-destructive" />} /></td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          Aktif
        </span>
      </td>
    </tr>
  )
}

function StudentMobileRow({ student }: { student: StudentRow }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <StudentAvatar name={student.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/guru/siswa/${encodeURIComponent(student.studentId)}`}
            className="truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {student.name}
          </Link>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {student.speakingScore === null ? '—' : `${student.speakingScore}/100`}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{student.className}</span>
          <span aria-hidden="true">·</span>
          <span>{student.level === null ? 'Level —' : `Level ${student.level}`}</span>
          <span aria-hidden="true">·</span>
          <span>{student.streak === null ? 'Streak —' : `${student.streak} hari`}</span>
        </div>
      </div>
    </div>
  )
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
  return (
    <Avatar className="h-9 w-9 shrink-0">
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
    </Avatar>
  )
}

function SortBtn({
  label,
  active,
  asc,
  onClick,
}: {
  label: string
  active: boolean
  asc: boolean
  onClick: () => void
}) {
  const Icon = !active ? ArrowUpDown : asc ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Urutkan berdasarkan ${label}`}
      className={cn(
        'flex items-center gap-1 uppercase tracking-[0.08em] transition-colors',
        active ? 'text-foreground' : 'hover:text-foreground',
      )}
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  )
}

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>
  const clamped = Math.min(100, Math.max(0, score))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground">{score}</span>
    </div>
  )
}

function MetricCell({ value, icon }: { value: number | null; icon?: ReactNode }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-foreground">
      {icon}
      {value}
    </span>
  )
}
