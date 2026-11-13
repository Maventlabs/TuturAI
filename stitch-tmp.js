const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const dir = '/vercel/share/artifacts/tuturai-fullpage/segs'
const outPath = '/vercel/share/artifacts/tuturai-fullpage/tuturai-landing-full.png'

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))

if (!files.length) throw new Error('no segments found')

const first = PNG.sync.read(fs.readFileSync(path.join(dir, files[0])))
const W = first.width
const H = parseInt(process.argv[2] || '0', 10)
if (!H) throw new Error('pass total height as argv[2]')

const out = new PNG({ width: W, height: H })
for (let i = 0; i < out.data.length; i += 4) {
  out.data[i] = 255
  out.data[i + 1] = 255
  out.data[i + 2] = 255
  out.data[i + 3] = 255
}

for (const f of files) {
  const y = parseInt(f, 10)
  const img = PNG.sync.read(fs.readFileSync(path.join(dir, f)))
  const rows = Math.min(img.height, H - y)
  for (let row = 0; row < rows; row++) {
    const srcStart = row * img.width * 4
    const dstStart = (y + row) * W * 4
    img.data.copy(out.data, dstStart, srcStart, srcStart + img.width * 4)
  }
}

fs.writeFileSync(outPath, PNG.sync.write(out))
console.log('stitched', W + 'x' + H, 'from', files.length, 'segments')
