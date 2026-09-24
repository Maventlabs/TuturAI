'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    try {
      await signOut(getFirebaseAuth())
    } catch {
      // The server session is cleared even if the client session is unavailable.
    }
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
      Keluar
    </Button>
  )
}
