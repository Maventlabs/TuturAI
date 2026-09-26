'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Classroom } from '@tuturai/domain'
import { Search, ArrowUpDown, Flame, Circle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
            className="h-10 w-full rounded-lg border border-border bg-secondary/60 pl-9 pr-3 text-sm outline-none ring-ring placeholder:text-muted-foreground focus:ring-2"
          />
        </div>
        <Select value={classFilter} onValueChange={(value) => setClassFilter(value ?? 'all')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Semua kelas" />
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
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Belum ada classroom yang Anda miliki.
            </div>
          ) : students.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Belum ada siswa aktif di classroom Anda.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Tidak ada siswa yang cocok dengan pencarian atau filter.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3"><SortBtn label="Siswa" onClick={() => toggleSort('name')} /></th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3"><SortBtn label="Skor Speaking" onClick={() => toggleSort('speakingScore')} /></th>
                      <th className="px-4 py-3"><SortBtn label="Level" onClick={() => toggleSort('level')} /></th>
                      <th className="px-4 py-3"><SortBtn label="Streak" onClick={() => toggleSort('streak')} /></th>
                      <th className="px-4 py-3">Status</th>
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
            </>
          )}
        </Card>
      </FadeIn>
    </div>
  )
}

function StudentTableRow({ student }: { student: StudentRow }) {
  return (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-secondary/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <StudentAvatar name={student.name} />
          <div>
            <p className="font-medium text-foreground">{student.name}</p>
            <p className="text-xs text-muted-foreground">{student.email ?? 'Email tidak tersedia'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{student.className}</td>
       <td className="px-4 py-3"><ScoreCell score={student.speakingScore} /></td>
       <td className="px-4 py-3"><MetricCell value={student.level} label="Level" /></td>
       <td className="px-4 py-3"><MetricCell value={student.streak} label="Streak" icon={<Flame className="h-3.5 w-3.5" />} /></td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Circle className="h-2 w-2 fill-current text-success" /> Aktif
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
          <p className="truncate font-medium text-foreground">{student.name}</p>
           <span className="text-sm text-muted-foreground">{student.speakingScore === null ? 'Skor tidak tersedia' : `${student.speakingScore}/100`}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{student.className}</span>
          <span aria-hidden="true">•</span>
           <span>{student.level === null ? 'Level tidak tersedia' : `Level ${student.level}`}</span>
          <span aria-hidden="true">•</span>
           <span>{student.streak === null ? 'Streak tidak tersedia' : `${student.streak} hari streak`}</span>
        </div>
      </div>
    </div>
  )
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
  return (
    <Avatar className="h-9 w-9">
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
    </Avatar>
  )
}

function SortBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 font-medium uppercase tracking-wide transition-colors hover:text-foreground">
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )
}

function ScoreCell({ score }: { score: number | null }) {
  return (
    <div className="text-muted-foreground">
      <span>{score === null ? 'Skor tidak tersedia' : `${score}/100`}</span>
    </div>
  )
}

function MetricCell({ value, label, icon }: { value: number | null; label: string; icon?: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      {icon}
      <Badge variant="secondary">{value === null ? `${label} tidak tersedia` : value}</Badge>
    </span>
  )
}
