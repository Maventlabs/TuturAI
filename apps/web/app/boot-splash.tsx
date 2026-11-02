'use client'

import { useEffect, useState } from 'react'
import { BRAND_COLORS, SITE_NAME } from '@/lib/site'

export function BootSplash() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      id="boot-splash"
      role="status"
      aria-live="polite"
      aria-label={`${SITE_NAME} sedang memuat`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: BRAND_COLORS.canvas,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        transition: 'opacity .28s ease',
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 22,
          background: BRAND_COLORS.primary,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 10px 30px -12px rgba(47,109,245,.65)',
        }}
      >
        <img
          src="/brand/logo-icon.png"
          alt=""
          width={88}
          height={88}
          style={{ borderRadius: 22, display: 'block' }}
          decoding="async"
        />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: BRAND_COLORS.text }}>
        Tutur<span style={{ color: BRAND_COLORS.primary }}>AI</span>
      </div>
      <div
        style={{
          width: 132,
          height: 3,
          borderRadius: 99,
          background: '#d2d2d7',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '40%',
            borderRadius: 99,
            background: BRAND_COLORS.primary,
            animation: 'bs-slide 1.15s ease-in-out infinite',
          }}
        />
      </div>
      <div style={{ fontSize: 13, color: '#6e6e73' }}>
        Menyiapkan ruang latihan speaking&hellip;
      </div>
    </div>
  )
}
