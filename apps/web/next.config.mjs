import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateFirebaseProductionConfig } from './lib/firebase/client-config.mjs'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))

if (process.env.NODE_ENV === 'production') {
  try {
    validateFirebaseProductionConfig(process.env)
  } catch (error) {
    // Builds also run where the Firebase secrets are absent (CI, previews). Failing
    // here blocks every build and leaves stale HTML paired with fresh client chunks,
    // which surfaces as a hydration mismatch. The config is still enforced at runtime
    // by lib/firebase/client.ts before any Firebase client is created.
    console.warn(`[next.config] ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tuturai/domain', '@tuturai/validation'],
  // firebase-admin must stay external on serverless runtimes (Netlify Functions):
  // bundling it breaks module initialization at runtime and makes every /api/*
  // route return an empty 500 before any handler executes.
  serverExternalPackages: ['firebase-admin', 'firebase-admin/app', 'firebase-admin/auth', 'firebase-admin/firestore'],
  outputFileTracingRoot: path.join(appDirectory, '../..'),
  images: {
    unoptimized: true,
  },
  // Remove the framework fingerprint from every response.
  poweredByHeader: false,
  // Static media is content-addressed by filename and never mutated in place, so
  // repeat visits (and the 2.5 MB listening clips) should not re-download it.
  // Security headers stay in proxy.ts; this block only sets caching.
  async headers() {
    const mediaCache = 'public, max-age=86400, stale-while-revalidate=604800'
    const audioCache = 'public, max-age=604800, stale-while-revalidate=604800'
    return [
      { source: '/landing/:path*', headers: [{ key: 'Cache-Control', value: mediaCache }] },
      { source: '/brand/:path*', headers: [{ key: 'Cache-Control', value: mediaCache }] },
      { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: mediaCache }] },
      { source: '/learning/:path*', headers: [{ key: 'Cache-Control', value: mediaCache }] },
      { source: '/loader-:name.webp', headers: [{ key: 'Cache-Control', value: mediaCache }] },
      { source: '/audio/:path*', headers: [{ key: 'Cache-Control', value: audioCache }] },
    ]
  },
}

export default nextConfig
