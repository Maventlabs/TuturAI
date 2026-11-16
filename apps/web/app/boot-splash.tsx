'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { StackLoader } from '@/components/ui/stack-loader'
import { SITE_NAME } from '@/lib/site'

const LOADER_IMAGES = [
  '/loader-student.webp',
  '/loader-dashboard.webp',
  '/loader-flashcards.webp',
  '/loader-listening.webp',
  '/loader-teacher.webp',
]

export function BootSplash() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const handleComplete = useCallback(() => setVisible(false), [])

  useEffect(() => {
    const timeoutId = window.setTimeout(handleComplete, 6000)
    return () => window.clearTimeout(timeoutId)
  }, [handleComplete])

  // Only the marketing landing page gets the splash on a hard load. Every other
  // route paints immediately, and client-side navigation never remounts this.
  if (pathname !== '/' || !visible) return null

  return (
    <StackLoader
      id="boot-splash"
      ariaLabel={`${SITE_NAME} sedang memuat`}
      images={LOADER_IMAGES}
      leftText="Berani bicara"
      rightText="Percaya diri"
      caption={`${SITE_NAME}: latihan speaking tanpa takut salah.`}
      imageSize={2}
      duration={0.8}
      fadeOutDuration={0.5}
      onComplete={handleComplete}
    />
  )
}
