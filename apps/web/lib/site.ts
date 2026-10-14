export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://tuturai-apps.netlify.app'
).replace(/\/+$/, '')

export const SITE_NAME = 'TuturAI'
export const SITE_TITLE = 'TuturAI — Latihan Speaking Bahasa Inggris dengan AI'
export const SITE_DESCRIPTION =
  'Platform latihan speaking Bahasa Inggris berbasis AI untuk siswa SMA/SMK Indonesia. Feedback instan, gamifikasi, dan dashboard analitik untuk guru.'
export const SITE_KEYWORDS = [
  'TuturAI',
  'latihan speaking bahasa Inggris',
  'speaking assessment AI',
  'bahasa Inggris SMA',
  'bahasa Inggris SMK',
  'guru bahasa Inggris',
  'adaptive learning',
]

/** Routes that are intentionally public and indexable. */
export const PUBLIC_ROUTES = [
  { path: '/', priority: 1 },
  { path: '/auth/login', priority: 0.8 },
  { path: '/auth/sign-up', priority: 0.8 },
  { path: '/auth/error', priority: 0.3 },
]

export const BRAND_COLORS = {
  primary: '#2f6df5',
  accent: '#0071e3',
  canvas: '#f5f5f7',
  surface: '#ffffff',
  text: '#1d1d1f',
} as const
