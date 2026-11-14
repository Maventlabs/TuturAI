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
}

export default nextConfig
