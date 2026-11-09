'use client'

import { useEffect, useState } from 'react'
import { listenToPresence, setPresence, removePresence, type PresenceEntry } from '@/lib/challenge-speaking'

export function usePresence(user: { uid: string; name: string; level: number } | null) {
  const [users, setUsers] = useState<PresenceEntry[]>([])
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    let unlisten: (() => void) | null = null

    const register = async () => {
      try {
        await setPresence(user.uid, user.name, user.level)
        if (cancelled) return
        unlisten = listenToPresence((entries) => {
          if (cancelled) return
          setUsers(entries)
          setOnlineCount(entries.length)
          setError(null)
        })
      } catch (e) {
        if (!cancelled) setError('Gagal terhubung ke server online. Coba lagi.')
      }
    }

    void register()
    return () => {
      cancelled = true
      if (unlisten) unlisten()
      removePresence(user.uid).catch(() => {})
    }
  }, [user?.uid, user?.name, user?.level])

  return { users, onlineCount, error }
}
