'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Assignment, Classroom, Material } from '@tuturai/domain'
import { classroomLevelLabel } from '@tuturai/domain'
import { ChevronRight } from 'lucide-react'
import { classBandColor } from '@/lib/class-tint'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTeacherName, type ClassroomMemberSummary } from '@/components/guru/use-classroom-overview'
import { StreamPanel } from '@/components/guru/stream-panel'
import { ClassworkPanel, type ComposerKind } from '@/components/guru/classwork-panel'
import { PeoplePanel } from '@/components/guru/people-panel'
import { GradesPanel } from '@/components/guru/grades-panel'

export type ClassroomTab = 'stream' | 'classwork' | 'people' | 'grades'

const TABS: Array<{ id: ClassroomTab; label: string }> = [
  { id: 'stream', label: 'Stream' },
  { id: 'classwork', label: 'Classwork' },
  { id: 'people', label: 'People' },
  { id: 'grades', label: 'Grades' },
]

type ApiResponse<T> = { data: T; error?: { message?: string } }

type ClassroomSnapshot = {
  classroom: Classroom
  members: ClassroomMemberSummary[]
  assignments: Assignment[]
  materials: Material[]
}

export function ClassroomDetail({
  classroomId,
  initialTab,
}: {
  classroomId: string
  initialTab: ClassroomTab
}) {
  const teacherName = useTeacherName()
  const [tab, setTab] = useState<ClassroomTab>(initialTab)
  const [composer, setComposer] = useState<ComposerKind | null>(null)
  const [snapshot, setSnapshot] = useState<ClassroomSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal): Promise<ClassroomSnapshot> => {
      const [classroomsResponse, membersResponse, assignmentsResponse, materialsResponse] = await Promise.all([
        fetch('/api/classrooms', { cache: 'no-store', signal }),
        fetch(`/api/classrooms/${classroomId}/members`, { cache: 'no-store', signal }),
        fetch(`/api/classrooms/${classroomId}/assignments`, { cache: 'no-store', signal }),
        fetch(`/api/classrooms/${classroomId}/materials`, { cache: 'no-store', signal }),
      ])

      const classroomsPayload = await classroomsResponse.json() as ApiResponse<Classroom[]>
      const membersPayload = await membersResponse.json() as ApiResponse<ClassroomMemberSummary[]>
      const assignmentsPayload = await assignmentsResponse.json() as ApiResponse<Assignment[]>
      const materialsPayload = await materialsResponse.json() as ApiResponse<Material[]>

      if (!classroomsResponse.ok) throw new Error(classroomsPayload.error?.message ?? 'Gagal memuat kelas')
      if (!membersResponse.ok) throw new Error(membersPayload.error?.message ?? 'Gagal memuat siswa')
      if (!assignmentsResponse.ok) throw new Error(assignmentsPayload.error?.message ?? 'Gagal memuat penugasan')
      if (!materialsResponse.ok) throw new Error(materialsPayload.error?.message ?? 'Gagal memuat materi')

      const found = classroomsPayload.data.find((item) => item.id === classroomId) ?? null
      if (!found) throw new Error('Kelas tidak ditemukan')

      return {
        classroom: found,
        members: membersPayload.data,
        assignments: assignmentsPayload.data,
        materials: materialsPayload.data,
      }
    },
    [classroomId],
  )

  useEffect(() => {
    const controller = new AbortController()

    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSnapshot(data)
          setError(null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [load])

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await load())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
    }
  }, [load])

  async function removeMember(studentId: string) {
    setRemovingId(studentId)
    setMemberError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/members/${studentId}`, { method: 'DELETE' })
      const payload = response.status === 204 ? null : await response.json()
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Gagal menghapus siswa')
      setSnapshot((current) =>
        current ? { ...current, members: current.members.filter((member) => member.studentId !== studentId) } : current,
      )
    } catch (cause) {
      setMemberError(cause instanceof Error ? cause.message : 'Gagal menghapus siswa')
    } finally {
      setRemovingId(null)
    }
  }

  function openComposer(kind: ComposerKind) {
    setTab('classwork')
    setComposer(kind)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
        <div className="h-5 w-48 animate-pulse rounded bg-secondary" />
        <div className="h-32 animate-pulse rounded-xl bg-secondary" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
      </div>
    )
  }

  if (error || !snapshot) {
    return (
      <div className="mx-auto max-w-5xl">
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error ?? 'Kelas tidak ditemukan'}</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/guru/kelas">Kembali ke daftar kelas</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { classroom, members, assignments, materials } = snapshot
  const band = classBandColor(classroom.id)
  const levelLabel = classroomLevelLabel(classroom.level)

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm">
        <Link href="/guru/kelas" className="font-medium text-primary-deep hover:underline">
          Kelas
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-muted-foreground">{classroom.name}</span>
      </nav>

      <div className="relative overflow-hidden rounded-xl px-6 py-6 sm:px-8" style={{ backgroundColor: band }}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{classroom.name}</h1>
              {levelLabel && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {levelLabel}
                </span>
              )}
              {classroom.status === 'archived' && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Diarsipkan
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-white/85">
              {classroom.school ?? 'TuturAI Classroom'} · {teacherName}
            </p>
          </div>

          <dl className="flex items-center gap-6">
            {[
              { label: 'siswa', value: members.length },
              { label: 'penugasan', value: assignments.length },
              { label: 'materi', value: materials.length },
            ].map((stat) => (
              <div key={stat.label}>
                <dd className="font-heading text-xl font-bold tabular-nums text-white">{stat.value}</dd>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-white/70">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div role="tablist" aria-label="Bagian kelas" className="mb-5 mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors',
              tab === item.id
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'stream' && (
        <StreamPanel
          classroom={classroom}
          assignments={assignments}
          band={band}
          teacherName={teacherName}
          onCompose={() => openComposer('assignment')}
        />
      )}

      {tab === 'classwork' && (
        <ClassworkPanel
          classroomId={classroomId}
          assignments={assignments}
          materials={materials}
          composer={composer}
          onComposerChange={setComposer}
          onRefresh={refresh}
        />
      )}

      {tab === 'people' && (
        <PeoplePanel
          members={members}
          teacherName={teacherName}
          band={band}
          removingId={removingId}
          memberError={memberError}
          onRemove={removeMember}
        />
      )}

      {tab === 'grades' && <GradesPanel assignments={assignments} members={members} />}
    </div>
  )
}
