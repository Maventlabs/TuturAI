// Extracts the white bird glyph from logo-icon.png (white bird on a blue
// square) and re-renders it as a blue bird on a transparent background.
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const srcPath = path.join(__dirname, '..', 'public', 'brand', 'logo-icon.png')
const outPath = path.join(__dirname, '..', 'public', 'brand', 'logo-mark-blue.png')

const src = PNG.sync.read(fs.readFileSync(srcPath))
const { width, height, data } = src

// Background color sampled from the top-left corner.
const bgR = data[0]
const bgG = data[1]
const bgB = data[2]

// Primary blue from the design tokens (#2f6df5).
const outR = 0x2f
const outG = 0x6d
const outB = 0xf5

const out = new PNG({ width, height })

for (let i = 0; i < width * height; i++) {
  const r = data[i * 4]
  // The glyph is white on blue, so the red channel gives the widest
  // dynamic range for estimating per-pixel coverage (anti-aliased edges
  // become partial alpha instead of a hard cutoff).
  let a = (r - bgR) / (255 - bgR)
  a = Math.max(0, Math.min(1, a))
  out.data[i * 4] = outR
  out.data[i * 4 + 1] = outG
  out.data[i * 4 + 2] = outB
  out.data[i * 4 + 3] = Math.round(a * 255)
}

// Trim transparent margins, keeping a small padding around the glyph.
let minX = width
let minY = height
let maxX = 0
let maxY = 0
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (out.data[(y * width + x) * 4 + 3] > 8) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
}

const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04)
minX = Math.max(0, minX - pad)
minY = Math.max(0, minY - pad)
maxX = Math.min(width - 1, maxX + pad)
maxY = Math.min(height - 1, maxY + pad)

const w = maxX - minX + 1
const h = maxY - minY + 1
const trimmed = new PNG({ width: w, height: h })

for (let y = 0; y < h; y++) {
  const srcStart = ((minY + y) * width + minX) * 4
  out.data.copy(trimmed.data, y * w * 4, srcStart, srcStart + w * 4)
}

fs.writeFileSync(outPath, PNG.sync.write(trimmed))
console.log(`bg=rgb(${bgR},${bgG},${bgB}) -> ${w}x${h} written to ${outPath}`)
