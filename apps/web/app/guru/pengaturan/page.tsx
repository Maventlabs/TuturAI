'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IdentityPanel, type TeacherProfile } from '@/components/guru/settings/identity-panel'
import {
  IntegrationsPanel,
  type DriveStatus,
  type VoiceProfileStatus,
} from '@/components/guru/settings/integrations-panel'
import { NotificationsPanel, type NotificationPrefs } from '@/components/guru/settings/notifications-panel'
import { SecurityPanel } from '@/components/guru/settings/security-panel'
import { SettingsRail, type ReadinessItem } from '@/components/guru/settings/settings-rail'

// The date is formatted in the viewer's timezone, so it is read only after
// hydration — the server snapshot stays null to keep SSR and client in sync.
const subscribeToNothing = () => () => {}
const getTodayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

async function pollVoiceProfile(
  signal: AbortSignal,
  updateProfile: (profile: VoiceProfileStatus) => void,
  setError: (message: string | null) => void,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (signal.aborted) return
    try {
      const response = await fetch('/api/teacher/voice-profile', { cache: 'no-store', signal })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error?.message ?? 'Status voice profile tidak tersedia')
        return
      }
      updateProfile(payload.data)
      if (payload.data?.status !== 'processing') return
    } catch {
      if (!signal.aborted) setError('Status voice profile tidak tersedia')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (!signal.aborted) setError('Proses voice masih berjalan. Periksa status kembali untuk melanjutkan.')
}

function buildHeadline(
  profile: TeacherProfile | null,
  drive: DriveStatus | null,
  voice: VoiceProfileStatus | null,
) {
  if (!profile) return 'Membaca konfigurasi akun…'

  const missing: string[] = []
  if (!profile.school) missing.push('data sekolah')
  if (!profile.subject) missing.push('mata pelajaran')
  if (!drive?.connected) missing.push('Google Drive')
  if (voice?.status !== 'ready') missing.push('voice profile')

  if (missing.length === 0) return 'Semua konfigurasi akun sudah lengkap dan aktif.'
  return `Profil terbaca. Yang belum siap: ${missing.join(', ')}.`
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [drive, setDrive] = useState<DriveStatus | null>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  const [voiceProfile, setVoiceProfile] = useState<VoiceProfileStatus | null>(null)
  const [voiceText, setVoiceText] = useState('')
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [voiceConsent, setVoiceConsent] = useState(false)
  const [voiceEnrollmentKey, setVoiceEnrollmentKey] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('Hello, welcome to our English class.')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [notif, setNotif] = useState<NotificationPrefs>({
    submissions: true,
    lowScore: true,
    weekly: false,
    device: true,
  })
  const [savedNotif, setSavedNotif] = useState<NotificationPrefs | null>(null)
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifMessage, setNotifMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const voicePollController = useRef<AbortController | null>(null)
  const today = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => null)

  useEffect(() => {
    void fetch('/api/me', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message ?? 'Profil tidak tersedia')
        setProfile(payload.data.profile)
      })
      .catch((cause) => setProfileError(cause instanceof Error ? cause.message : 'Profil tidak tersedia'))
  }, [])

  useEffect(() => {
    void fetch('/api/integrations/google-drive/status', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message ?? 'Status Google Drive tidak tersedia')
        setDrive(payload.data)
      })
      .catch((cause) => setDriveError(cause instanceof Error ? cause.message : 'Status Google Drive tidak tersedia'))
  }, [])

  useEffect(() => {
    void fetch('/api/teacher/preferences', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message ?? 'Preferensi notifikasi tidak tersedia')
        setNotif(payload.data)
        setSavedNotif(payload.data)
      })
      .catch((cause) =>
        setNotifMessage({
          tone: 'error',
          text: cause instanceof Error ? cause.message : 'Preferensi notifikasi tidak tersedia',
        }),
      )
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    voicePollController.current = controller
    void pollVoiceProfile(controller.signal, setVoiceProfile, setVoiceError)
    return () => {
      controller.abort()
      voicePollController.current?.abort()
    }
  }, [])

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  const checkVoiceStatus = useCallback(() => {
    voicePollController.current?.abort()
    const controller = new AbortController()
    voicePollController.current = controller
    setVoiceError(null)
    void pollVoiceProfile(controller.signal, setVoiceProfile, setVoiceError)
  }, [])

  async function disconnectDrive() {
    setDriveBusy(true)
    setDriveError(null)
    try {
      const response = await fetch('/api/integrations/google-drive/disconnect', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memutuskan Google Drive')
      setDrive(payload.data)
    } catch (cause) {
      setDriveError(cause instanceof Error ? cause.message : 'Gagal memutuskan Google Drive')
    } finally {
      setDriveBusy(false)
    }
  }

  async function saveNotifications() {
    setNotifBusy(true)
    setNotifMessage(null)
    try {
      const response = await fetch('/api/teacher/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(notif),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Preferensi notifikasi gagal disimpan')
      setNotif(payload.data)
      setSavedNotif(payload.data)
      setNotifMessage({ tone: 'ok', text: 'Preferensi notifikasi tersimpan di server.' })
    } catch (cause) {
      setNotifMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Preferensi notifikasi gagal disimpan',
      })
    } finally {
      setNotifBusy(false)
    }
  }

  async function enrollVoice() {
    if (!voiceFile || !voiceText.trim() || !voiceConsent) return
    const idempotencyKey = voiceEnrollmentKey ?? crypto.randomUUID()
    setVoiceEnrollmentKey(idempotencyKey)
    setVoiceBusy(true)
    setVoiceError(null)
    try {
      const form = new FormData()
      form.set('audio', voiceFile)
      form.set('referenceText', voiceText)
      form.set('consent', String(voiceConsent))
      const response = await fetch('/api/teacher/voice-profile', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: form,
      })
      const payload = await response.json()
      if (!response.ok) {
        if (payload.error?.details?.status === 'failed') {
          setVoiceProfile({ status: 'failed', errorCode: payload.error?.details?.code ?? null })
        }
        throw new Error(payload.error?.message ?? 'Pendaftaran voice profile gagal')
      }
      setVoiceProfile(payload.data)
      setVoiceFile(null)
      setVoiceText('')
      if (payload.data?.status === 'processing') checkVoiceStatus()
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : 'Pendaftaran voice profile gagal')
    } finally {
      setVoiceBusy(false)
    }
  }

  async function deleteVoice() {
    setVoiceBusy(true)
    setVoiceError(null)
    try {
      voicePollController.current?.abort()
      const response = await fetch('/api/teacher/voice-profile', { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Penghapusan voice profile gagal')
      setVoiceProfile(payload.data)
      setVoiceEnrollmentKey(null)
      setVoiceConsent(false)
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : 'Penghapusan voice profile gagal')
    } finally {
      setVoiceBusy(false)
    }
  }

  async function previewVoice() {
    setVoiceBusy(true)
    setVoiceError(null)
    try {
      const response = await fetch('/api/teacher/voice-preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: previewText }),
      })
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error?.message ?? 'Preview voice gagal')
      }
      const blob = await response.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : 'Preview voice gagal')
    } finally {
      setVoiceBusy(false)
    }
  }

  const readiness: ReadinessItem[] = [
    {
      label: 'Profil',
      done: Boolean(profile?.displayName && profile?.email),
      note: profile?.displayName ? 'lengkap' : 'belum',
    },
    { label: 'Sekolah', done: Boolean(profile?.school), note: profile?.school ? 'lengkap' : 'belum' },
    { label: 'Drive', done: Boolean(drive?.connected), note: drive?.connected ? 'terhubung' : 'belum' },
    {
      label: 'Voice',
      done: voiceProfile?.status === 'ready',
      note: voiceProfile?.status === 'ready' ? 'aktif' : 'belum',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div className="rounded-lg border border-border bg-card">
        <header className="border-b border-rule px-5 py-5 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Pengaturan Guru{today ? ` · ${today}` : ''}
          </p>
          <h1 className="mt-4 max-w-[58ch] text-balance font-sans text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
            {buildHeadline(profile, drive, voiceProfile)}
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            Notifikasi tersimpan ke server &middot; identitas dari Firebase &middot; integrasi terpisah dari login
          </p>
        </header>

        <div className="lg:flex">
          <SettingsRail readiness={readiness} />

          <div className="min-w-0 divide-y divide-rule">
            <IdentityPanel profile={profile} error={profileError} />

            <IntegrationsPanel
              drive={drive}
              driveBusy={driveBusy}
              driveError={driveError}
              onDisconnectDrive={() => void disconnectDrive()}
              voice={voiceProfile}
              voiceBusy={voiceBusy}
              voiceError={voiceError}
              voiceText={voiceText}
              voiceFile={voiceFile}
              voiceConsent={voiceConsent}
              onVoiceTextChange={(value) => {
                setVoiceText(value)
                setVoiceEnrollmentKey(null)
              }}
              onVoiceFileChange={(file) => {
                setVoiceFile(file)
                setVoiceEnrollmentKey(null)
              }}
              onVoiceConsentChange={setVoiceConsent}
              onEnroll={() => void enrollVoice()}
              onDelete={() => void deleteVoice()}
              onCheckStatus={checkVoiceStatus}
              previewText={previewText}
              previewUrl={previewUrl}
              onPreviewTextChange={setPreviewText}
              onPreview={() => void previewVoice()}
            />

            <NotificationsPanel
              value={notif}
              saved={savedNotif}
              busy={notifBusy}
              message={notifMessage}
              onChange={setNotif}
              onSave={() => void saveNotifications()}
              onReset={() => {
                if (savedNotif) setNotif(savedNotif)
                setNotifMessage(null)
              }}
            />

            <SecurityPanel email={profile?.email ?? null} />

            <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Tema mengikuti tombol di bilah atas
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Profil dikelola lewat onboarding Firebase
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
