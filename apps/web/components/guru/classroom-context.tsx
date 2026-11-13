'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Assignment, Classroom, Material } from '@tuturai/domain'
import type { ClassroomMemberSummary } from '@/components/guru/use-classroom-overview'

type ApiResponse<T> = { data: T; error?: { message?: string } }

export type ClassroomSnapshot = {
  classroom: Classroom
  members: ClassroomMemberSummary[]
  assignments: Assignment[]
  materials: Material[]
}

type ClassroomContextValue = {
  classroomId: string
  snapshot: ClassroomSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  removingId: string | null
  memberError: string | null
  removeMember: (studentId: string) => Promise<void>
}

const ClassroomContext = createContext<ClassroomContextValue | null>(null)

export function ClassroomProvider({
  classroomId,
  children,
}: {
  classroomId: string
  children: React.ReactNode
}) {
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
        if (controller.signal.aborted) return
        setSnapshot(data)
        setError(null)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [load])

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await load())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
    }
  }, [load])

  const removeMember = useCallback(
    async (studentId: string) => {
      setRemovingId(studentId)
      setMemberError(null)
      try {
        const response = await fetch(`/api/classrooms/${classroomId}/members/${studentId}`, { method: 'DELETE' })
        const payload = response.status === 204 ? null : await response.json()
        if (!response.ok) throw new Error(payload?.error?.message ?? 'Gagal menghapus siswa')
        setSnapshot((current) =>
          current
            ? { ...current, members: current.members.filter((member) => member.studentId !== studentId) }
            : current,
        )
      } catch (cause) {
        setMemberError(cause instanceof Error ? cause.message : 'Gagal menghapus siswa')
      } finally {
        setRemovingId(null)
      }
    },
    [classroomId],
  )

  return (
    <ClassroomContext.Provider
      value={{ classroomId, snapshot, loading, error, refresh, removingId, memberError, removeMember }}
    >
      {children}
    </ClassroomContext.Provider>
  )
}

export function useClassroom() {
  const value = useContext(ClassroomContext)
  if (!value) throw new Error('useClassroom harus dipakai di dalam ClassroomProvider')
  return value
}

export function ClassroomBody({
  children,
}: {
  children: (snapshot: ClassroomSnapshot) => React.ReactNode
}) {
  const { snapshot, loading, error } = useClassroom()

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-36 animate-pulse rounded-xl bg-secondary" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
      </div>
    )
  }

  if (error || !snapshot) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error ?? 'Kelas tidak ditemukan'}</p>
      </div>
    )
  }

  return <>{children(snapshot)}</>
}
