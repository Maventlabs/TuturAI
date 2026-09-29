// One-off dev tooling: convert the two large landing PNGs to optimized WebP.
// Not imported by the app; executed manually during PERF-001.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// sharp lives in the pnpm store (onlyBuiltDependencies), not in the root
// package.json; resolve it from there without adding a production dependency.
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/.pnpm/sharp@0.35.4_@types+node@24.13.6/node_modules/'))
const sharp = require('sharp')

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public')

const jobs = [
  { input: 'hero-student.png', output: 'hero-student.webp', width: 960 },
  { input: 'teacher-dashboard.png', output: 'teacher-dashboard.webp', width: 960 },
]

for (const job of jobs) {
  const input = path.join(publicDir, job.input)
  const output = path.join(publicDir, job.output)
  const info = await sharp(input)
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(output)
  console.log(`${job.input} -> ${job.output}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`)
}
