/**
 * Integration seam test: the real web `HttpVoiceProvider` contract against a
 * running OmniVoice service.
 *
 * This reproduces exactly what `apps/web/lib/ai/voice-provider.ts` sends, so a
 * pass proves the browser-side adapter and the local service agree on the wire
 * format without needing a Firebase session.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.OMNIVOICE_URL ?? 'http://127.0.0.1:8087'
const TOKEN = process.env.OMNIVOICE_API_KEY ?? 'local-dev-token'
const API_KEY = { Authorization: `Bearer ${TOKEN}` }

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` -> ${detail}`}`)
}

/** Minimal 24 kHz mono WAV with a voiced signal, mirroring what a teacher uploads. */
function referenceWav(seconds = 2.5, rate = 24000) {
  const frames = new Int16Array(Math.floor(rate * seconds))
  for (let i = 0; i < frames.length; i += 1) {
    const t = i / rate
    frames[i] = Math.round(6000 * Math.sin(2 * Math.PI * 180 * t) + 2500 * Math.sin(2 * Math.PI * 360 * t))
  }
  const buffer = Buffer.alloc(44 + frames.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + frames.length * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(frames.length * 2, 40)
  Buffer.from(frames.buffer).copy(buffer, 44)
  return buffer
}

/** Mirrors HttpVoiceProvider.enroll() exactly. */
async function enrollVoice() {
  const form = new FormData()
  form.append('audio', new Blob([referenceWav()], { type: 'audio/wav' }), 'reference-audio')
  form.append('ref_text', 'Hello, my name is Freeman and this is a reference recording.')
  const response = await fetch(`${BASE}/v1/voice-clones`, {
    method: 'POST',
    body: form,
    headers: { ...API_KEY, 'Idempotency-Key': 'seam-test-0001' },
  })
  return { status: response.status, payload: await response.json().catch(() => null) }
}

/** Mirrors HttpVoiceProvider.getStatus(). */
async function getStatus(voiceId) {
  const response = await fetch(`${BASE}/v1/voice-clones/${encodeURIComponent(voiceId)}`, {
    headers: { Accept: 'application/json', ...API_KEY },
  })
  return { status: response.status, payload: await response.json().catch(() => null) }
}

/** Mirrors HttpVoiceProvider.synthesize(). */
async function synthesize(voiceId, text) {
  const response = await fetch(`${BASE}/v1/audio/speech`, {
    method: 'POST',
    headers: { Accept: 'audio/*', 'Content-Type': 'application/json', ...API_KEY },
    body: JSON.stringify({ voice_id: voiceId, input: text }),
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  return { status: response.status, buffer, contentType: response.headers.get('content-type') }
}

async function main() {
  console.log(`\nIntegration seam: web HttpVoiceProvider contract -> ${BASE}\n`)

  const health = await (await fetch(`${BASE}/health`)).json()
  check('service reports a loaded voice backend', health.loaded === true, JSON.stringify(health))
  check('service is on the GGUF/Q8 path', health.backend === 'omnivoice-gguf', String(health.backend))

  const unauthorized = await fetch(`${BASE}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: 'x', input: 'hi' }),
  })
  check('bearer token is required', unauthorized.status === 401, String(unauthorized.status))

  const started = Date.now()
  const enroll = await enrollVoice()
  check('enroll() shape accepted', enroll.status === 200 && enroll.payload?.status === 'ready', JSON.stringify(enroll.payload))
  const voiceId = enroll.payload?.id
  if (!voiceId) {
    console.log('  cannot continue without a voice id')
    process.exit(1)
  }

  const status = await getStatus(voiceId)
  check('getStatus() reports ready', status.payload?.status === 'ready', JSON.stringify(status.payload))

  const speech = await synthesize(voiceId, 'Hello, this is a short test of the TuturAI voice pipeline.')
  check('synthesize() returns audio', speech.status === 200 && speech.buffer.length > 0, String(speech.status))
  check('synthesize() content-type is audio', (speech.contentType ?? '').startsWith('audio/'), String(speech.contentType))
  check('synthesize() payload is a RIFF/WAV', speech.buffer.subarray(0, 4).toString() === 'RIFF', speech.buffer.subarray(0, 8).toString('hex'))

  // Prove it is real speech, not a silent placeholder.
  const samples = new Int16Array(speech.buffer.buffer, speech.buffer.byteOffset + 44, Math.floor((speech.buffer.length - 44) / 2))
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const audible = samples.filter((v) => Math.abs(v) > 50).length / samples.length
  const seconds = samples.length / 24000
  console.log(`  audio: ${seconds.toFixed(2)}s  peak=${peak}  audible=${(audible * 100).toFixed(1)}%  wall-clock=${((Date.now() - started) / 1000).toFixed(1)}s`)
  check('audio is audible, not a silent placeholder', peak > 1000 && audible > 0.05, `peak=${peak} audible=${audible}`)

  const removed = await fetch(`${BASE}/v1/voice-clones/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: API_KEY })
  check('delete() returns 204', removed.status === 204, String(removed.status))

  const after = await getStatus(voiceId)
  check('deleted voice no longer reports ready', after.payload?.status !== 'ready', JSON.stringify(after.payload))

  mkdirSync(join(process.cwd(), '..', '.playwright-mcp'), { recursive: true })
  writeFileSync(join(process.cwd(), '..', '.playwright-mcp', 'omnivoice-sample.wav'), speech.buffer)

  console.log()
  if (failures) {
    console.log(`INTEGRATION SEAM FAILED: ${failures} check(s)`)
    process.exit(1)
  }
  console.log('INTEGRATION SEAM PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
