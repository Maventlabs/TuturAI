'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  LeaderboardSheet,
  type ClassroomFilter,
  type LeaderboardRow,
} from '@/components/guru/leaderboard/leaderboard-sheet'

// The date is formatted in the viewer's timezone, so it is read only after
// hydration — the server snapshot stays null to keep SSR and client in sync.
const subscribeToNothing = () => () => {}
const getTodayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

type ApiResponse = { data: LeaderboardRow[]; error?: { message?: string } }

export default function TeacherLeaderboardPage() {
  const [classrooms, setClassrooms] = useState<ClassroomFilter[]>([])
  const [members, setMembers] = useState<LeaderboardRow[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const today = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadLeaderboard() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/teacher/leaderboard', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await response.json()) as ApiResponse
        if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat leaderboard')
        setClassrooms([
          ...new Map(payload.data.map((row) => [row.classId, { id: row.classId, name: row.className }])).values(),
        ])
        setMembers(payload.data)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat leaderboard')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadLeaderboard()
    return () => controller.abort()
  }, [reloadToken])

  return (
    <LeaderboardSheet
      rows={members}
      classrooms={classrooms}
      filter={filter}
      onFilterChange={setFilter}
      loading={loading}
      error={error}
      onRetry={() => setReloadToken((value) => value + 1)}
      today={today}
    />
  )
}
