'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, getAdditionalUserInfo, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AuthFlowError, authErrorMessage, firebaseAuthErrorCode, logGoogleAuthFailure, serverAuthErrorCode, serverConfigField, serverFirebaseAuthErrorCode, serverRequestId } from '@/lib/firebase/auth-errors'
import { getFirebaseClientDiagnostics } from '@/lib/firebase/client'
import { GraduationCap, Presentation, Loader2 } from 'lucide-react'
import { GoogleIcon } from '@/components/auth/google-icon'

type Role = 'student' | 'teacher'

const fieldClass = 'h-12 rounded-md px-4 text-[15px] md:text-[15px]'
const labelClass = 'text-[13px] font-semibold text-foreground'

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
      logGoogleAuthFailure(error, {
        failureStage: 'firebase-popup',
        ...getFirebaseClientDiagnostics(),
        currentOrigin: window.location.origin,
        popupOrRedirect: 'popup',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      })
      setError(authErrorMessage(error, 'google'))
      setLoading(false)
    }
  }

  async function finishOnboarding(user: { getIdToken: () => Promise<string> }, displayName: string) {
    let idToken: string
    try {
      idToken = await user.getIdToken()
    } catch (error) {
      throw new AuthFlowError('onboarding', 0, 'FIREBASE_ID_TOKEN_UNAVAILABLE', firebaseAuthErrorCode(error))
    }

    let response: Response
    try {
      response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          displayName,
          school,
          role,
          ...(role === 'student' ? { className: extra } : { subject: extra }),
        }),
      })
    } catch {
      throw new AuthFlowError('onboarding', 0, 'ONBOARDING_NETWORK_ERROR')
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new AuthFlowError('onboarding', response.status, serverAuthErrorCode(payload) ?? `HTTP_${response.status}`, serverFirebaseAuthErrorCode(payload), serverRequestId(response), serverConfigField(payload))
    }
    await establishSession(user)
    redirectToDashboard()
  }

  async function establishSession(user: { getIdToken: () => Promise<string> }) {
    let idToken: string
    try {
      idToken = await user.getIdToken()
    } catch (error) {
      throw new AuthFlowError('server-session', 0, 'FIREBASE_ID_TOKEN_UNAVAILABLE', firebaseAuthErrorCode(error))
    }

    let response: Response
    try {
      response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
    } catch {
      throw new AuthFlowError('server-session', 0, 'SESSION_NETWORK_ERROR')
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new AuthFlowError('server-session', response.status, serverAuthErrorCode(payload) ?? `HTTP_${response.status}`, serverFirebaseAuthErrorCode(payload), serverRequestId(response), serverConfigField(payload))
    }
  }

  function redirectToDashboard() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className={labelClass}>Saya seorang</Label>
        <div className="grid grid-cols-2 gap-3">
          <RoleCard active={role === 'student'} onClick={() => setRole('student')} icon={<GraduationCap className="h-5 w-5" />} label="Siswa" />
          <RoleCard active={role === 'teacher'} onClick={() => setRole('teacher')} icon={<Presentation className="h-5 w-5" />} label="Guru" />
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="fullName" className={labelClass}>Nama Lengkap</Label><Input id="fullName" required autoComplete="name" placeholder="Nama lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldClass} /></div>
      <div className="space-y-2"><Label htmlFor="email" className={labelClass}>Email</Label><Input id="email" type="email" required autoComplete="email" placeholder="nama@sekolah.id" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="school" className={labelClass}>Asal Sekolah</Label><Input id="school" required autoComplete="organization" placeholder="Nama sekolah" value={school} onChange={(e) => setSchool(e.target.value)} className={fieldClass} /></div>
        <div className="space-y-2"><Label htmlFor="extra" className={labelClass}>{role === 'student' ? 'Kelas' : 'Mata Pelajaran'}</Label><Input id="extra" required placeholder={role === 'student' ? 'Contoh: XI IPA 2' : 'Contoh: Bahasa Inggris'} value={extra} onChange={(e) => setExtra(e.target.value)} className={fieldClass} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="password" className={labelClass}>Kata Sandi</Label><Input id="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Buat kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} /></div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-12 w-full rounded-md text-[15px] font-semibold" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Buat Akun</Button>
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-xs text-muted-foreground">atau</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <Button type="button" variant="outline" className="h-12 w-full rounded-md text-[15px] font-semibold" disabled={loading} onClick={handleGoogleSignUp}><GoogleIcon className="size-[18px]" />Daftar dengan Google</Button>
    </form>
  )
}

function RoleCard({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn('flex items-center gap-3 rounded-md border px-4 py-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50', active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-foreground/25')}><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{icon}</span><span className={cn('text-[15px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span></button>
}
