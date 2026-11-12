'use client'

import { useCallback, useState } from 'react'
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
  const [visible, setVisible] = useState(true)
  const handleComplete = useCallback(() => setVisible(false), [])

  if (!visible) return null

  return (
    <StackLoader
      id="boot-splash"
      ariaLabel={`${SITE_NAME} sedang memuat`}
      images={LOADER_IMAGES}
      leftText="Berani bicara"
      rightText="Percaya diri"
      caption={`${SITE_NAME} — latihan speaking tanpa takut salah.`}
      imageSize={2}
      duration={0.8}
      fadeOutDuration={0.5}
      onComplete={handleComplete}
    />
  )
}
