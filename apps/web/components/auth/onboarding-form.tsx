'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OnboardingForm() {
  const router = useRouter()
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [displayName, setDisplayName] = useState('')
  const [school, setSchool] = useState('')
  const [extra, setExtra] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = getFirebaseAuth().currentUser
      if (!user) throw new Error('AUTH_REQUIRED')
      const token = await user.getIdToken()
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName,
          school,
          role,
          ...(role === 'student' ? { className: extra } : { subject: extra }),
        }),
      })
      if (!response.ok) throw new Error('ONBOARDING_FAILED')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Profil belum dapat disimpan. Periksa koneksi dan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-12">
      <form onSubmit={submit} className="w-full space-y-6 rounded-2xl border bg-card p-6">
        <div><p className="text-sm font-medium text-primary">Langkah terakhir</p><h1 className="mt-1 text-2xl font-semibold">Lengkapi profil TuturAI</h1><p className="mt-2 text-sm text-muted-foreground">Role disimpan permanen untuk menjaga akses data tetap aman.</p></div>
        <div className="grid grid-cols-2 gap-3"><Button type="button" variant={role === 'student' ? 'default' : 'outline'} onClick={() => setRole('student')}>Siswa</Button><Button type="button" variant={role === 'teacher' ? 'default' : 'outline'} onClick={() => setRole('teacher')}>Guru</Button></div>
        <div className="space-y-2"><Label htmlFor="displayName">Nama lengkap</Label><Input id="displayName" required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="school">Sekolah</Label><Input id="school" required minLength={2} value={school} onChange={(event) => setSchool(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="extra">{role === 'student' ? 'Kelas' : 'Mata pelajaran'}</Label><Input id="extra" value={extra} onChange={(event) => setExtra(event.target.value)} /></div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan dan lanjutkan'}</Button>
      </form>
    </main>
  )
}
