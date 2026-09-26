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
  outputFileTracingRoot: path.join(appDirectory, '../..'),
  images: {
    unoptimized: true,
  },
}

export default nextConfig
