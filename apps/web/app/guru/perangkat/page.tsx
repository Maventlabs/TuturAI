'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { DeviceSheet } from '@/components/guru/devices/device-sheet'
import type { DeviceRow, PairingTicket } from '@/components/guru/devices/types'

const POLL_MS = 15_000
const CLOCK_MS = 10_000

type DevicesPayload = { data?: DeviceRow[]; error?: { message?: string } }
type PairingPayload = {
  data?: { device?: { id?: string }; pairing?: { code?: string; expiresAt?: string } }
  error?: { message?: string }
}

async function fetchDevices(signal?: AbortSignal) {
  const response = await fetch('/api/teacher/devices', { cache: 'no-store', signal })
  const payload = await response.json() as DevicesPayload
  if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat perangkat')
  if (!Array.isArray(payload.data)) throw new Error('Respons status perangkat tidak valid')
  return payload.data
}

// The date is formatted in the viewer's timezone, so it is read only after
// hydration — the server snapshot stays null to keep SSR and client in sync.
const subscribeToNothing = () => () => {}
const getTodayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [ticket, setTicket] = useState<PairingTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [reloadKey, setReloadKey] = useState(0)
  const today = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDevices() {
      try {
        const data = await fetchDevices(controller.signal)
        if (controller.signal.aborted) return
        setDevices(data)
        setError(null)
        setNow(Date.now())
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Gagal memuat perangkat')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadDevices()
    return () => controller.abort()
  }, [reloadKey])

  // Heartbeats arrive every 30s, so the fleet view refreshes itself while visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void fetchDevices()
        .then((data) => {
          setDevices(data)
          setError(null)
          setNow(Date.now())
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat perangkat')
        })
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => window.clearInterval(timer)
  }, [])

  const requestPairing = useCallback(async (body: { label?: string; deviceId?: string }, busyKey: string) => {
    setBusy(busyKey)
    setActionError(null)
    try {
      const response = await fetch('/api/teacher/devices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json() as PairingPayload
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal membuat kode pairing')
      const code = payload.data?.pairing?.code
      const expiresAt = payload.data?.pairing?.expiresAt
      const deviceId = payload.data?.device?.id
      if (!code || !expiresAt || !deviceId) throw new Error('Respons pairing tidak lengkap')
      setTicket({ deviceId, code, expiresAt })
      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Gagal membuat kode pairing')
    } finally {
      setBusy(null)
    }
  }, [])

  const register = useCallback(
    (label: string) => {
      void requestPairing(label ? { label } : {}, 'register')
    },
    [requestPairing],
  )

  const reissue = useCallback(
    (deviceId: string) => {
      void requestPairing({ deviceId }, deviceId)
    },
    [requestPairing],
  )

  const revoke = useCallback(async (deviceId: string) => {
    setBusy(deviceId)
    setActionError(null)
    try {
      const response = await fetch(`/api/teacher/devices?deviceId=${encodeURIComponent(deviceId)}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(payload?.error?.message ?? 'Gagal mencabut perangkat')
      }
      setTicket((current) => (current?.deviceId === deviceId ? null : current))
      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Gagal mencabut perangkat')
    } finally {
      setBusy(null)
    }
  }, [])

  return (
    <DeviceSheet
      devices={devices}
      ticket={ticket}
      loading={loading}
      error={error}
      actionError={actionError}
      busy={busy}
      now={now}
      today={today}
      onRetry={() => setReloadKey((key) => key + 1)}
      onRegister={register}
      onReissue={reissue}
      onRevoke={(deviceId) => void revoke(deviceId)}
      onDismissTicket={() => setTicket(null)}
    />
  )
}
