import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tuturai/domain', '@tuturai/validation'],
  outputFileTracingRoot: path.join(appDirectory, '../..'),
  images: {
    unoptimized: true,
  },
}

export default nextConfig
