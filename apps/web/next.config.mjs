import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateFirebaseProductionConfig } from './lib/firebase/client-config.mjs'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))

if (process.env.NODE_ENV === 'production') {
  validateFirebaseProductionConfig(process.env)
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
}

export default nextConfig
