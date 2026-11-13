'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AnalyticsPeriod } from '@/components/guru/overview/period-switch'
import { AnalyticsSheet, type AnalyticsData } from '@/components/guru/analytics/analytics-sheet'

// The date is formatted in the viewer's timezone, so it is read only after
// hydration — the server snapshot stays null to keep SSR and client in sync.
const subscribeToNothing = () => () => {}
const getTodayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>('all')
  const [downloading, setDownloading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const today = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadAnalytics() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/teacher/analytics?period=${period}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await response.json()) as { data?: AnalyticsData; error?: { message?: string } }
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? 'Gagal memuat analitik.')
        }
        if (!controller.signal.aborted) setAnalytics(payload.data)
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Gagal memuat analitik.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadAnalytics()
    return () => controller.abort()
  }, [period, reloadToken])

  // The analytics payload only carries student ids. Names are resolved from the
  // teacher's classrooms so the attention list reads as people, not uids.
  useEffect(() => {
    const controller = new AbortController()

    async function loadNames() {
      try {
        const response = await fetch('/api/classrooms', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const payload = (await response.json()) as { data?: Array<{ id: string }> }
        const classrooms = payload.data ?? []
        const memberLists = await Promise.all(
          classrooms.map(async (classroom) => {
            const membersResponse = await fetch(`/api/classrooms/${classroom.id}/members`, {
              cache: 'no-store',
              signal: controller.signal,
            })
            if (!membersResponse.ok) return []
            const membersPayload = (await membersResponse.json()) as {
              data?: Array<{ studentId: string; name: string }>
            }
            return membersPayload.data ?? []
          }),
        )
        if (controller.signal.aborted) return
        const map = new Map<string, string>()
        for (const member of memberLists.flat()) {
          if (!map.has(member.studentId)) map.set(member.studentId, member.name)
        }
        setNames(map)
      } catch {
        // Names are a nicety; the attention list falls back to a neutral label.
      }
    }

    void loadNames()
    return () => controller.abort()
  }, [])

  async function downloadReport() {
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch(`/api/teacher/reports?period=${period}`)
      if (!response.ok) throw new Error('Laporan belum dapat dibuat.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `tuturai-report-${period}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Laporan belum dapat dibuat.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AnalyticsSheet
      analytics={analytics}
      names={names}
      period={period}
      onPeriodChange={setPeriod}
      onDownload={() => void downloadReport()}
      downloading={downloading}
      loading={loading}
      error={error}
      onRetry={() => setReloadToken((value) => value + 1)}
      today={today}
    />
  )
}
