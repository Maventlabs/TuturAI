'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, School, GraduationCap, Bell, Volume2, Globe, Palette } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { FadeIn } from '@/components/dashboard/fade-in'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { LogoutButton } from '@/components/auth/logout-button'
type StudentProfile = {
  full_name: string | null
  email: string | null
  school: string | null
  class: string | null
  xp: number
  level: number
  streak: number | null
  rank: number | null
}

export default function ProfilPage() {
  const router = useRouter()
  const [notif, setNotif] = useState(true)
  const [sound, setSound] = useState(true)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [classroomName, setClassroomName] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [school, setSchool] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/student/dashboard', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('PROFILE_LOAD_FAILED')
        return response.json() as Promise<{ data?: { profile?: StudentProfile; classrooms?: { name: string }[] } }>
      })
      .then((payload) => {
        if (!payload.data?.profile) throw new Error('PROFILE_INVALID')
        setProfile(payload.data.profile)
        setDisplayName(payload.data.profile.full_name ?? '')
        setSchool(payload.data.profile.school ?? '')
        setClassroomName(payload.data.classrooms?.[0]?.name ?? null)
      })
      .catch(() => setError(true))
      .finally(() => setProfileLoading(false))
  }, [])

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, school }),
      })
      const payload = await response.json() as { data?: { profile?: StudentProfile }; error?: { message?: string } }
      if (!response.ok || !payload.data?.profile) {
        throw new Error(payload.error?.message ?? 'Profil belum dapat disimpan')
      }

      setProfile(payload.data.profile)
      setDisplayName(payload.data.profile.full_name ?? '')
      setSchool(payload.data.profile.school ?? '')
      setSaveMessage('Profil tersimpan di server.')
      router.refresh()
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Profil belum dapat disimpan')
    } finally {
      setSaving(false)
    }
  }

  const stats = profile ? [
    { label: 'Level', value: String(profile.level) },
    { label: 'Total XP', value: profile.xp.toLocaleString('id-ID') },
    { label: 'Streak', value: profile.streak === null ? '—' : `${profile.streak} hari` },
    { label: 'Peringkat', value: profile.rank === null ? '—' : `#${profile.rank}` },
  ] : []

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profil & Pengaturan"
        description="Kelola informasi akun dan preferensi belajarmu."
      />
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Profil belum dapat dimuat dari server.</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn className="lg:col-span-1">
          <Card className="flex flex-col items-center gap-4 border-border p-6 text-center">
            <Avatar className="h-24 w-24 ring-4 ring-primary/15">
              <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                {(profile?.full_name ?? 'Siswa').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-bold text-foreground">{profile?.full_name ?? 'Memuat profil...'}</h2>
              <p className="text-sm text-muted-foreground">{classroomName ?? 'Belum bergabung classroom'}</p>
            </div>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              Level {profile?.level ?? '—'}
            </Badge>
            <p className="text-center text-xs text-muted-foreground">{profile ? `${profile.xp.toLocaleString('id-ID')} XP tersimpan` : 'Memuat XP...'}</p>
          </Card>
        </FadeIn>

        <div className="space-y-6 lg:col-span-2">
          <FadeIn>
            <Card className="border-border p-6">
              <h3 className="text-base font-semibold text-foreground">Statistik</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl bg-muted/50 p-4 text-center">
                    <p className="font-heading text-2xl font-extrabold text-foreground">
                      {s.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </FadeIn>

          <FadeIn>
            <Card className="border-border p-6">
              <h3 className="text-base font-semibold text-foreground">Informasi Akun</h3>
              <div className="mt-4 space-y-3">
                <InfoRow icon={Mail} label="Email" value={profile?.email ?? 'Belum tersedia'} />
                <InfoRow icon={School} label="Sekolah" value={profile?.school ?? 'Belum tersedia'} />
                <InfoRow icon={GraduationCap} label="Kelas" value={profile?.class ?? classroomName ?? 'Belum tersedia'} />
              </div>
            </Card>
          </FadeIn>

          <FadeIn>
            <Card className="border-border p-6">
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Edit Profil</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Nama dan sekolah tersimpan pada profil akunmu. Role dan progres dikelola server.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-display-name">Nama lengkap</Label>
                    <Input id="profile-display-name" required minLength={2} maxLength={120} disabled={profileLoading || saving} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-school">Sekolah</Label>
                    <Input id="profile-school" required minLength={2} maxLength={160} disabled={profileLoading || saving} value={school} onChange={(event) => setSchool(event.target.value)} />
                  </div>
                </div>
                {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
                {saveMessage && <p role="status" className="text-sm text-primary">{saveMessage}</p>}
                <Button type="submit" disabled={profileLoading || saving}>{profileLoading ? 'Memuat profil...' : saving ? 'Menyimpan...' : 'Simpan profil'}</Button>
              </form>
            </Card>
          </FadeIn>

          <FadeIn>
            <Card className="border-border p-6">
              <h3 className="text-base font-semibold text-foreground">Preferensi</h3>
              <div className="mt-4 space-y-1">
                <PrefRow icon={Bell} label="Notifikasi" desc="Pengingat misi & streak harian">
                  <Switch checked={notif} onCheckedChange={setNotif} />
                </PrefRow>
                <Separator />
                <PrefRow icon={Volume2} label="Efek Suara" desc="Suara saat menyelesaikan latihan">
                  <Switch checked={sound} onCheckedChange={setSound} />
                </PrefRow>
                <Separator />
                <PrefRow icon={Palette} label="Tema Tampilan" desc="Mode terang atau gelap">
                  <ThemeToggle />
                </PrefRow>
                <Separator />
                <PrefRow icon={Globe} label="Bahasa Antarmuka" desc="Bahasa Indonesia">
                  <span className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                    Bahasa Indonesia
                  </span>
                </PrefRow>
              </div>
            </Card>
          </FadeIn>

          <FadeIn className="flex justify-end">
            <LogoutButton />
          </FadeIn>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function PrefRow({
  icon: Icon,
  label,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
