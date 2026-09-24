'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, type User } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { authErrorMessage } from '@/lib/firebase/auth-errors'

async function establishSession(authenticatedUser?: User) {
  const user = authenticatedUser ?? getFirebaseAuth().currentUser
  if (!user) throw new Error('Sesi Firebase tidak tersedia')
  const idToken = await user.getIdToken()
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) throw new Error('Sesi server gagal dibuat')
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function finishAuth() {
    await establishSession()
    router.push('/dashboard')
    router.refresh()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
      await finishAuth()
    } catch (error) {
      setError(authErrorMessage(error, 'login'))
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
      await establishSession(credential.user)
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      setError(authErrorMessage(error, 'google'))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Kata Sandi</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Masuk
        </Button>
      </form>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={handleGoogle} disabled={loading}>
        Masuk dengan Google
      </Button>
    </div>
  )
}
