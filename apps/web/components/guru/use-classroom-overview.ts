'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Assignment, Classroom } from '@tuturai/domain'
import type { TeacherReviewQueueItem } from '@/lib/submissions'

export interface ClassroomMemberSummary {
  studentId: string
  name: string
  email: string | null
  joinedAt: string
  level?: number | null
  streak?: number | null
  speakingScore?: number | null
}

export interface ClassroomOverview extends Classroom {
  members: ClassroomMemberSummary[]
  assignments: Assignment[]
  pendingReview: number
}

type ApiResponse<T> = { data: T; error?: { message?: string } }

export function useClassroomOverview() {
  const [classrooms, setClassrooms] = useState<ClassroomOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const classroomsResponse = await fetch('/api/classrooms', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const classroomsPayload = await classroomsResponse.json() as ApiResponse<Classroom[]>
        if (!classroomsResponse.ok) {
          throw new Error(classroomsPayload.error?.message ?? 'Gagal memuat kelas')
        }

        const [summaries, queue] = await Promise.all([
          Promise.all(classroomsPayload.data.map(async (classroom) => {
            const [membersResponse, assignmentsResponse] = await Promise.all([
              fetch(`/api/classrooms/${classroom.id}/members`, { cache: 'no-store', signal: controller.signal }),
              fetch(`/api/classrooms/${classroom.id}/assignments`, { cache: 'no-store', signal: controller.signal }),
            ])
            const membersPayload = await membersResponse.json() as ApiResponse<ClassroomMemberSummary[]>
            const assignmentsPayload = await assignmentsResponse.json() as ApiResponse<Assignment[]>
            if (!membersResponse.ok) {
              throw new Error(membersPayload.error?.message ?? `Gagal memuat siswa dari ${classroom.name}`)
            }
            if (!assignmentsResponse.ok) {
              throw new Error(assignmentsPayload.error?.message ?? `Gagal memuat penugasan dari ${classroom.name}`)
            }
            return {
              ...classroom,
              members: membersPayload.data,
              assignments: assignmentsPayload.data,
              pendingReview: 0,
            }
          })),
          fetch('/api/submissions/review-queue', { cache: 'no-store', signal: controller.signal })
            .then(async (response) => {
              if (!response.ok) return [] as TeacherReviewQueueItem[]
              const payload = await response.json() as ApiResponse<TeacherReviewQueueItem[]>
              return payload.data ?? []
            })
            .catch(() => [] as TeacherReviewQueueItem[]),
        ])

        const pendingByClass = new Map<string, number>()
        for (const item of queue) {
          const classId = item.assignment.classId
          pendingByClass.set(classId, (pendingByClass.get(classId) ?? 0) + 1)
        }

        if (!controller.signal.aborted) {
          setClassrooms(summaries.map((summary) => ({
            ...summary,
            pendingReview: pendingByClass.get(summary.id) ?? 0,
          })))
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((value) => value + 1), [])

  return { classrooms, loading, error, reload }
}

export function useTeacherName() {
  const [name, setName] = useState('Guru')

  useEffect(() => {
    let cancelled = false
    void fetch('/api/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return
        const fullName = payload.data?.profile?.full_name
        if (typeof fullName === 'string' && fullName.trim()) setName(fullName)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return name
}
