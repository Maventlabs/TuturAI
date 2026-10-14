'use client'

import { useEffect } from 'react'

/**
 * Marks the document as hydrated so the launch screen can be removed.
 *
 * The check must be "React has hydrated", not "the server sent markup": App
 * Router already ships rendered HTML, so `app-root` has children during the very
 * first paint and hiding on that would remove the splash immediately.
 */
export function AppHydratedMarker() {
  useEffect(() => {
    document.documentElement.dataset.appReady = 'true'
  }, [])
  return null
}