'use client'

import { useEffect, useMemo, useState } from 'react'
import { useClassroomOverview } from '@/components/guru/use-classroom-overview'
import { GradebookView } from '@/components/guru/gradebook/gradebook-view'
import { buildGradebook, type GradebookInput } from '@/lib/gradebook'

const NO_INPUTS: GradebookInput[] = []

interface LoadedGradebook {
  key: string
  inputs: GradebookInput[]
  error: string | null
}

export default function GradebookPage() {
  const { classrooms, loading, error, reload } = useClassroomOverview()
  const [activeClassId, setActiveClassId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<LoadedGradebook | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const activeClass = classrooms.find((classroom) => classroom.id === activeClassId) ?? classrooms[0] ?? null
  const resolvedClassId = activeClass?.id ?? null
  const assignmentKey = activeClass ? activeClass.assignments.map((assignment) => assignment.id).join('|') : ''
  const requestKey = `${resolvedClassId ?? ''}|${assignmentKey}|${reloadToken}`

  const gradebook = useMemo(
    () =>
      buildGradebook(
        loaded?.inputs ?? NO_INPUTS,
        activeClass?.members.map((member) => ({ studentId: member.studentId, name: member.name })) ?? [],
      ),
    [loaded, activeClass],
  )

  useEffect(() => {
    if (!resolvedClassId || !assignmentKey) return
    const controller = new AbortController()
    const key = `${resolvedClassId}|${assignmentKey}|${reloadToken}`

    void Promise.all(
      assignmentKey.split('|').map(async (assignmentId) => {
        const response = await fetch(`/api/assignments/${assignmentId}/submissions`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await response.json()) as {
          data?: { assignment: { id: string; title: string }; students: GradebookInput['students'] }
          error?: { message?: string }
        }
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? 'Gagal memuat nilai penugasan')
        }
        return {
          assignment: { id: payload.data.assignment.id, title: payload.data.assignment.title },
          students: payload.data.students,
        } satisfies GradebookInput
      }),
    )
      .then((inputs) => {
        if (!controller.signal.aborted) setLoaded({ key, inputs, error: null })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({
          key,
          inputs: NO_INPUTS,
          error: cause instanceof Error ? cause.message : 'Gagal memuat nilai',
        })
      })

    return () => controller.abort()
  }, [resolvedClassId, assignmentKey, reloadToken])

  const gradebookLoading = assignmentKey.length > 0 && loaded?.key !== requestKey

  return (
    <GradebookView
      className={activeClass?.name ?? null}
      gradebook={gradebook}
      loading={loading || gradebookLoading}
      error={error ?? (loaded?.key === requestKey ? loaded.error : null)}
      classrooms={classrooms.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
        studentCount: classroom.members.length,
      }))}
      activeClassId={resolvedClassId}
      onSelectClass={setActiveClassId}
      onRetry={() => {
        reload()
        setReloadToken((token) => token + 1)
      }}
    />
  )
}
