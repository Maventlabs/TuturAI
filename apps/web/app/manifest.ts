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
    // `window-controls-overlay` is deliberately NOT used: it replaces the app
    // chrome with an OS title-bar strip that reads like a browser search bar
    // inside the installed app. Plain `standalone` keeps the PWA chrome-free.
    orientation: 'portrait',
    lang: 'id',
    dir: 'ltr',
    background_color: BRAND_COLORS.canvas,
    theme_color: BRAND_COLORS.primary,
    categories: ['education', 'productivity'],
    prefer_related_applications: false,
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
    // PWABuilder asks for screenshots to enrich the store listing. These point
    // at the same public capture surface; replace with real store shots later.
    screenshots: [
      {
        src: '/brand/og-screenshot-1280x720.jpg',
        sizes: '1280x720',
        type: 'image/jpeg',
        form_factor: 'wide',
        label: 'TuturAI untuk desktop',
      },
      {
        src: '/brand/og-screenshot-720x1280.jpg',
        sizes: '720x1280',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'TuturAI untuk mobile',
      },
    ],
    shortcuts: [
      { name: 'Dashboard Siswa', url: '/siswa' },
      { name: 'Dashboard Guru', url: '/guru' },
    ],
  }
}
