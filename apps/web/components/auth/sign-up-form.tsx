'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, getAdditionalUserInfo, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { authErrorMessage } from '@/lib/firebase/auth-errors'
import { GraduationCap, Presentation, Loader2 } from 'lucide-react'

type Role = 'student' | 'teacher'

export function SignUpForm() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [school, setSchool] = useState('')
  const [extra, setExtra] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
      await updateProfile(credential.user, { displayName: fullName })
      await finishOnboarding(credential.user, fullName)
    } catch (error) {
      setError(authErrorMessage(error, 'signup'))
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    setLoading(true)
    setError(null)
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
      if (!getAdditionalUserInfo(credential)?.isNewUser) {
        await establishSession(credential.user)
        redirectToDashboard()
        return
      }
      await finishOnboarding(credential.user, credential.user.displayName ?? fullName)
    } catch (error) {
      setError(authErrorMessage(error, 'google'))
      setLoading(false)
    }
  }

  async function finishOnboarding(user: { getIdToken: () => Promise<string> }, displayName: string) {
    const idToken = await user.getIdToken()
    const response = await fetch('/api/auth/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        displayName,
        school,
        role,
        ...(role === 'student' ? { className: extra } : { subject: extra }),
      }),
    })
    if (!response.ok) throw new Error('Onboarding gagal')
    await establishSession(user)
    redirectToDashboard()
  }

  async function establishSession(user: { getIdToken: () => Promise<string> }) {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken() }),
    })
    if (!response.ok) throw new Error('Sesi server gagal dibuat')
  }

  function redirectToDashboard() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Saya seorang</Label>
        <div className="grid grid-cols-2 gap-3">
          <RoleCard active={role === 'student'} onClick={() => setRole('student')} icon={<GraduationCap className="h-5 w-5" />} label="Siswa" />
          <RoleCard active={role === 'teacher'} onClick={() => setRole('teacher')} icon={<Presentation className="h-5 w-5" />} label="Guru" />
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="fullName">Nama Lengkap</Label><Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="school">Asal Sekolah</Label><Input id="school" required value={school} onChange={(e) => setSchool(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="extra">{role === 'student' ? 'Kelas' : 'Mata Pelajaran'}</Label><Input id="extra" required value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="password">Kata Sandi</Label><Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Buat Akun</Button>
      <div className="relative py-1 text-center text-xs text-muted-foreground"><span className="bg-background px-2">atau</span><span className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" /></div>
      <Button type="button" variant="outline" className="h-11 w-full" disabled={loading} onClick={handleGoogleSignUp}>Daftar dengan Google</Button>
    </form>
  )
}

function RoleCard({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn('flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all', active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40')}><span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{icon}</span><span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span></button>
}
