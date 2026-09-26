'use client'

import { useEffect, useState } from 'react'
import { User, Bell, Shield, Palette, School, Mic2, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [notif, setNotif] = useState({
    submissions: true,
    lowScore: true,
    weekly: false,
    device: true,
  })
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifMessage, setNotifMessage] = useState<string | null>(null)
  const [drive, setDrive] = useState<{ connected: boolean; scope: string | null; updatedAt: string | null } | null>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [voiceProfile, setVoiceProfile] = useState<{ status: string; providerVoiceId?: string } | null>(null)
  const [voiceText, setVoiceText] = useState('')
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ displayName: string; email: string; school: string; subject: string | null } | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('Hello, welcome to our English class.')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/teacher/preferences', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (response.ok) setNotif(payload.data)
      else setNotifMessage(payload.error?.message ?? 'Preferensi notifikasi tidak tersedia')
    }).catch(() => setNotifMessage('Preferensi notifikasi tidak tersedia'))
  }, [])

  useEffect(() => {
    void fetch('/api/integrations/google-drive/status', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (response.ok) setDrive(payload.data)
      else setDriveError(payload.error?.message ?? 'Status Google Drive tidak tersedia')
    }).catch(() => setDriveError('Status Google Drive tidak tersedia'))
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    void fetch('/api/teacher/voice-profile', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (response.ok) setVoiceProfile(payload.data)
      else setVoiceError(payload.error?.message ?? 'Status voice profile tidak tersedia')
    }).catch(() => setVoiceError('Status voice profile tidak tersedia'))
  }, [])

  useEffect(() => {
    void fetch('/api/me', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Profil tidak tersedia')
      setProfile(payload.data.profile)
    }).catch((cause) => setProfileError(cause instanceof Error ? cause.message : 'Profil tidak tersedia'))
  }, [])

  async function disconnectDrive() {
    setDriveBusy(true); setDriveError(null)
    try {
      const response = await fetch('/api/integrations/google-drive/disconnect', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memutuskan Google Drive')
      setDrive(payload.data)
    } catch (cause) {
      setDriveError(cause instanceof Error ? cause.message : 'Gagal memutuskan Google Drive')
    } finally { setDriveBusy(false) }
  }

  async function saveNotifications() {
    setNotifBusy(true); setNotifMessage(null)
    try {
      const response = await fetch('/api/teacher/preferences', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(notif) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Preferensi notifikasi gagal disimpan')
      setNotif(payload.data)
      setNotifMessage('Preferensi notifikasi tersimpan di server.')
    } catch (cause) {
      setNotifMessage(cause instanceof Error ? cause.message : 'Preferensi notifikasi gagal disimpan')
    } finally { setNotifBusy(false) }
  }

  async function enrollVoice() {
    if (!voiceFile || !voiceText.trim()) return
    setVoiceBusy(true); setVoiceError(null)
    try {
      const form = new FormData()
      form.set('audio', voiceFile)
      form.set('referenceText', voiceText)
      form.set('consent', 'true')
      const response = await fetch('/api/teacher/voice-profile', { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Pendaftaran voice profile gagal')
      setVoiceProfile(payload.data)
      setVoiceFile(null); setVoiceText('')
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : 'Pendaftaran voice profile gagal')
    } finally { setVoiceBusy(false) }
  }

  async function deleteVoice() {
    setVoiceBusy(true); setVoiceError(null)
    try {
      const response = await fetch('/api/teacher/voice-profile', { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Penghapusan voice profile gagal')
      setVoiceProfile(payload.data)
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : 'Penghapusan voice profile gagal')
    } finally { setVoiceBusy(false) }
  }

  async function previewVoice() {
    setVoiceBusy(true); setVoiceError(null)
    try {
      const response = await fetch('/api/teacher/voice-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: previewText }) })
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error?.message ?? 'Preview voice gagal')
      }
      const blob = await response.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : 'Preview voice gagal')
    } finally { setVoiceBusy(false) }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pengaturan"
        description="Kelola profil, preferensi notifikasi, dan konfigurasi kelas."
      >
        <span className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          Profil dikelola melalui onboarding Firebase
        </span>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <FadeIn className="lg:col-span-3">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">Google Drive</h3>
                <p className="mt-1 text-sm text-muted-foreground">Simpan lampiran tugas dan submission pada Drive guru dengan scope drive.file.</p>
                {driveError && <p role="alert" className="mt-2 text-sm text-destructive">{driveError}</p>}
                {drive && <p className="mt-2 text-xs text-muted-foreground">Status: {drive.connected ? 'Terhubung' : 'Belum terhubung'}{drive.updatedAt ? ` · diperbarui ${new Date(drive.updatedAt).toLocaleString('id-ID')}` : ''}</p>}
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" disabled={driveBusy}><a href="/api/integrations/google-drive/start">{drive?.connected ? 'Hubungkan ulang' : 'Hubungkan Google Drive'}</a></Button>
                {drive?.connected && <Button variant="outline" size="sm" disabled={driveBusy} onClick={() => void disconnectDrive()}>Putuskan</Button>}
              </div>
            </div>
          </Card>
        </FadeIn>
        <FadeIn className="lg:col-span-3">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Mic2 className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">Voice profile OmniVoice</h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Gunakan hanya dengan persetujuan Anda. Sample audio diproses oleh provider dan tidak disimpan oleh TuturAI.</p>
                  {voiceProfile && <p className="mt-2 text-xs text-muted-foreground">Status: {voiceProfile.status === 'not_configured' ? 'Belum terdaftar' : voiceProfile.status}</p>}
                  {voiceError && <p role="alert" className="mt-2 text-sm text-destructive">{voiceError}</p>}
                </div>
              </div>
              {voiceProfile?.status && voiceProfile.status !== 'not_configured' && <Button variant="outline" size="sm" onClick={() => void deleteVoice()} disabled={voiceBusy} className="gap-2"><Trash2 className="h-4 w-4" />Hapus profile</Button>}
            </div>
            {(!voiceProfile || voiceProfile.status === 'not_configured' || voiceProfile.status === 'failed') && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="space-y-1 text-sm font-medium">Transcript sample<input value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="Tulis persis kalimat yang direkam" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-sm font-medium">Sample audio<input type="file" accept="audio/*" onChange={(event) => setVoiceFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" /></label>
              <Button onClick={() => void enrollVoice()} disabled={voiceBusy || !voiceFile || voiceText.trim().length < 3}>{voiceBusy ? 'Memproses...' : 'Daftarkan voice'}</Button>
            </div>}
            {voiceProfile?.status === 'ready' && <div className="mt-5 space-y-3">
              <label className="block space-y-1 text-sm font-medium">Preview audio<input value={previewText} onChange={(event) => setPreviewText(event.target.value)} maxLength={500} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <Button variant="outline" onClick={() => void previewVoice()} disabled={voiceBusy || !previewText.trim()}>Putar preview</Button>
              {previewUrl && <audio controls src={previewUrl} className="h-9 w-full max-w-md" />}
            </div>}
          </Card>
        </FadeIn>
        {/* Profile */}
        <FadeIn className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                Profil Guru
              </h3>
            </div>
            <Separator className="my-5" />
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                    HW
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">Foto profil belum tersedia</span>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                   <Input id="name" value={profile?.displayName ?? ''} readOnly placeholder="Memuat profil..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nip">NIP</Label>
                   <Input id="nip" value="" readOnly placeholder="Belum tersedia" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                   <Input id="email" type="email" value={profile?.email ?? ''} readOnly placeholder="Memuat profil..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Mata Pelajaran</Label>
                   <Input id="subject" value={profile?.subject ?? ''} readOnly placeholder="Belum tersedia" />
                </div>
              </div>
            </div>
            {profileError && <p role="alert" className="mt-4 text-sm text-destructive">{profileError}</p>}
          </Card>
        </FadeIn>

        {/* School */}
        <FadeIn>
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                Sekolah
              </h3>
            </div>
            <Separator className="my-5" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school">Nama Sekolah</Label>
                <Input id="school" value={profile?.school ?? ''} readOnly placeholder="Memuat profil..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Kota / Kabupaten</Label>
                <Input id="city" value="" readOnly placeholder="Belum tersedia" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Tahun Ajaran</Label>
                <Input id="year" value="" readOnly placeholder="Belum tersedia" />
              </div>
            </div>
          </Card>
        </FadeIn>

        {/* Notifications */}
        <FadeIn className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                Notifikasi
              </h3>
            </div>
            <Separator className="my-3" />
            <SettingRow
              title="Submission Baru"
              description="Beri tahu saat siswa mengirim rekaman speaking untuk dinilai"
            >
              <Switch
                checked={notif.submissions}
                onCheckedChange={(v) => setNotif((n) => ({ ...n, submissions: v }))}
              />
            </SettingRow>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => void saveNotifications()} disabled={notifBusy}>
                {notifBusy ? 'Menyimpan...' : 'Simpan preferensi'}
              </Button>
              {notifMessage && <p role="status" className="text-xs text-muted-foreground">{notifMessage}</p>}
            </div>
            <Separator />
            <SettingRow
              title="Skor Rendah"
              description="Peringatan saat skor siswa turun di bawah ambang batas"
            >
              <Switch
                checked={notif.lowScore}
                onCheckedChange={(v) => setNotif((n) => ({ ...n, lowScore: v }))}
              />
            </SettingRow>
            <Separator />
            <SettingRow
              title="Rangkuman Mingguan"
              description="Email ringkasan performa kelas setiap Senin pagi"
            >
              <Switch
                checked={notif.weekly}
                onCheckedChange={(v) => setNotif((n) => ({ ...n, weekly: v }))}
              />
            </SettingRow>
            <Separator />
            <SettingRow
              title="Status Perangkat"
              description="Pemberitahuan saat perangkat offline atau baterai rendah"
            >
              <Switch
                checked={notif.device}
                onCheckedChange={(v) => setNotif((n) => ({ ...n, device: v }))}
              />
            </SettingRow>
          </Card>
        </FadeIn>

        {/* Security & Appearance */}
        <FadeIn>
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                Keamanan
              </h3>
            </div>
            <Separator className="my-5" />
            <p className="text-sm text-muted-foreground">
              Perubahan password belum tersedia di TuturAI. Password dikelola
              melalui Firebase Auth dan tidak disimulasikan di halaman ini.
            </p>
            <Separator className="my-5" />
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-sm font-semibold text-foreground">
                Tampilan
              </h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Gunakan tombol tema di bilah atas untuk beralih mode terang/gelap.
            </p>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
