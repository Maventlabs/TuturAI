import type { MetadataRoute } from 'next'
import { BRAND_COLORS, SITE_NAME } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` decouples the installed identity from start_url so the manifest can
    // change without the PWA being treated as a new app.
    id: '/',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      'Latihan speaking Bahasa Inggris berbasis AI untuk siswa dan guru Indonesia.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'portrait',
    lang: 'id',
    dir: 'ltr',
    background_color: BRAND_COLORS.canvas,
    theme_color: BRAND_COLORS.primary,
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Dashboard Siswa', url: '/siswa' },
      { name: 'Dashboard Guru', url: '/guru' },
    ],
  }
}
