/**
 * Renders the listening bank to one-minute WAV files under
 * `public/audio/listening`.
 *
 * Two providers are supported:
 *
 *   --provider piper   (default) local neural TTS, no quota, deterministic
 *   --provider gemini  the app's configured Gemini TTS (AI_TTS_*), which is
 *                      quota-limited on the free tier and falls back to piper
 *                      per line when a request is rejected
 *
 * Each script is synthesised line by line so a dialogue can alternate voices,
 * then joined with a short pause. The result is measured and re-rendered with a
 * corrected speaking rate until it lands near one minute, so every recording in
 * the bank has the same listening length.
 *
 * Usage:
 *   node scripts/render-listening-audio.mjs [--provider piper|gemini] [--only <id>] [--force]
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LISTENING_BANK } from './listening-bank-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const AUDIO_DIR = join(HERE, '..', 'public', 'audio', 'listening')
const PIPER_BIN = process.env.PIPER_BIN ?? '/tmp/ttsenv/bin/piper'
const PIPER_VOICE_DIR = process.env.PIPER_VOICE_DIR ?? '/tmp/piper-voices'
const TARGET_SECONDS = 60
const MIN_SECONDS = 54
const MAX_SECONDS = 68
const LINE_GAP_SECONDS = 0.45

const args = process.argv.slice(2)
const provider = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : 'piper'
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const force = args.includes('--force')

const PIPER_VOICES = {
  lessac: 'en_US-lessac-medium',
  ryan: 'en_US-ryan-high',
  alba: 'en_GB-alba-medium',
}

// Gemini has no voice cloning, so each scripted speaker maps to a distinct
// prebuilt voice to keep the two sides of a dialogue separable.
const GEMINI_VOICES = {
  lessac: 'Kore',
  ryan: 'Puck',
  alba: 'Aoede',
}

function loadLocalEnv() {
  const candidates = [join(HERE, '..', '..', '..', '.env.development.local'), join(HERE, '..', '..', '.env.local')]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    for (const line of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].trim().replace(/^["']+/, '').replace(/["']+$/, '')
    }
    return
  }
}

loadLocalEnv()

function readWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file')
  }
  let offset = 12
  let format = null
  let data = null
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') {
      format = {
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = buffer.subarray(body, Math.min(body + size, buffer.length))
    }
    offset = body + size + (size % 2)
  }
  if (!format || !data) throw new Error('WAV is missing fmt or data')
  return { ...format, data }
}

function writeWav({ sampleRate, channels, bitsPerSample, data }) {
  const blockAlign = (channels * bitsPerSample) / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * blockAlign, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

function silence(sampleRate, channels, bitsPerSample, seconds) {
  const frames = Math.round(sampleRate * seconds)
  return Buffer.alloc(frames * channels * (bitsPerSample / 8))
}

function resampleSegment(segment, target) {
  if (segment.sampleRate === target.sampleRate
    && segment.channels === target.channels
    && segment.bitsPerSample === target.bitsPerSample) {
    return segment
  }
  if (segment.bitsPerSample !== 16 || target.bitsPerSample !== 16) {
    throw new Error(`Unsupported bit depth ${segment.bitsPerSample} -> ${target.bitsPerSample}`)
  }

  const frames = segment.data.length / (segment.channels * 2)
  const ratio = target.sampleRate / segment.sampleRate
  const outFrames = Math.max(1, Math.round(frames * ratio))
  const out = Buffer.alloc(outFrames * target.channels * 2)

  for (let frame = 0; frame < outFrames; frame += 1) {
    const position = Math.min(frames - 1, frame / ratio)
    const left = Math.floor(position)
    const right = Math.min(frames - 1, left + 1)
    const blend = position - left
    for (let channel = 0; channel < target.channels; channel += 1) {
      const sourceChannel = Math.min(channel, segment.channels - 1)
      const a = segment.data.readInt16LE((left * segment.channels + sourceChannel) * 2)
      const b = segment.data.readInt16LE((right * segment.channels + sourceChannel) * 2)
      const sample = Math.max(-32768, Math.min(32767, Math.round(a + (b - a) * blend)))
      out.writeInt16LE(sample, (frame * target.channels + channel) * 2)
    }
  }

  return { sampleRate: target.sampleRate, channels: target.channels, bitsPerSample: 16, data: out }
}

function run(command, commandArgs, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    const chunks = []
    const errors = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => errors.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${Buffer.concat(errors).toString().slice(0, 300)}`))
        return
      }
      resolve(Buffer.concat(chunks))
    })
    child.stdin.end(input)
  })
}

async function synthesizePiper(text, voice, lengthScale) {
  const model = join(PIPER_VOICE_DIR, `${PIPER_VOICES[voice]}.onnx`)
  if (!existsSync(model)) throw new Error(`Missing Piper voice model: ${model}`)
  const output = await run(
    PIPER_BIN,
    ['-m', model, '-f', '-', '--length-scale', String(lengthScale), '--sentence-silence', '0.25'],
    text,
  )
  return readWav(output)
}

async function synthesizeGemini(text, voice, lengthScale) {
  const baseUrl = process.env.AI_TTS_BASE_URL
  // Temporarily pointed at the quota-limited key so the per-line fallback to
  // piper can be exercised; AI_TTS_API_KEY remains the default.
  const apiKey = process.env.AI_TTS_API_KEY_3 ?? process.env.AI_TTS_API_KEY
  const modelId = process.env.AI_TTS_MODEL_ID_1
  if (!baseUrl || !apiKey || !modelId) throw new Error('Gemini TTS is not configured')

  // Gemini has no rate control, so a slower delivery is requested in the prompt.
  const pace = lengthScale > 1.05 ? ' Speak slowly and clearly, at a measured pace.' : ''
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${text}${pace}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICES[voice] ?? 'Kore' } } },
        },
      }),
    },
  )
  if (!response.ok) throw new Error(`Gemini TTS ${response.status}`)
  const payload = await response.json()
  const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData
  if (!inline?.data) throw new Error('Gemini TTS returned no audio')

  const bytes = Buffer.from(inline.data, 'base64')
  const mimeType = String(inline.mimeType ?? '')
  if (/audio\/(wav|x-wav|wave|mpeg|mp3|ogg)/i.test(mimeType)) return readWav(bytes)

  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1]) || 24_000
  const channels = Number(/channels=(\d+)/i.exec(mimeType)?.[1]) || 1
  return { sampleRate: rate, channels, bitsPerSample: 16, data: bytes }
}

async function renderItem(item, lengthScale) {
  const segments = []
  for (const [voice, text] of item.lines) {
    let segment
    if (provider === 'gemini') {
      try {
        segment = await synthesizeGemini(text, voice, lengthScale)
      } catch (error) {
        console.warn(`  gemini unavailable for ${item.id} (${error.message}); using piper`)
        segment = await synthesizePiper(text, voice, lengthScale)
      }
    } else {
      segment = await synthesizePiper(text, voice, lengthScale)
    }
    segments.push(segment)
  }

  // A line that falls back to piper arrives at 22.05 kHz while Gemini answers at
  // 24 kHz, so every segment is resampled to the first one before joining.
  const first = segments[0]
  const normalized = segments.map((segment) => resampleSegment(segment, first))

  const gap = silence(first.sampleRate, first.channels, first.bitsPerSample, LINE_GAP_SECONDS)
  const parts = []
  normalized.forEach((segment, index) => {
    if (index > 0) parts.push(gap)
    parts.push(segment.data)
  })
  const data = Buffer.concat(parts)
  const wav = writeWav({ ...first, data })
  const seconds = data.length / (first.sampleRate * first.channels * (first.bitsPerSample / 8))
  return { wav, seconds }
}

async function main() {
  mkdirSync(AUDIO_DIR, { recursive: true })
  const items = only ? LISTENING_BANK.filter((item) => item.id === only) : LISTENING_BANK
  if (items.length === 0) throw new Error(`No bank item matches ${only}`)

  const report = []
  for (const item of items) {
    const target = join(AUDIO_DIR, `${item.id}.wav`)
    if (!force && existsSync(target)) {
      const existing = readWav(readFileSync(target))
      const seconds = existing.data.length / (existing.sampleRate * existing.channels * (existing.bitsPerSample / 8))
      report.push({ id: item.id, seconds, skipped: true })
      console.log(`${item.id}  ${seconds.toFixed(1)}s  (kept existing)`)
      continue
    }

    let lengthScale = 1.12
    let result = await renderItem(item, lengthScale)
    for (let attempt = 0; attempt < 2 && (result.seconds < MIN_SECONDS || result.seconds > MAX_SECONDS); attempt += 1) {
      lengthScale = Math.min(1.7, Math.max(0.85, lengthScale * (TARGET_SECONDS / result.seconds)))
      result = await renderItem(item, lengthScale)
    }

    writeFileSync(target, result.wav)
    report.push({ id: item.id, seconds: result.seconds, lengthScale })
    console.log(`${item.id}  ${result.seconds.toFixed(1)}s  length-scale ${lengthScale.toFixed(2)}`)
  }

  const total = report.reduce((sum, entry) => sum + entry.seconds, 0)
  console.log(`\n${report.length} recordings, ${(total / 60).toFixed(1)} minutes total`)
  const offTarget = report.filter((entry) => entry.seconds < MIN_SECONDS || entry.seconds > MAX_SECONDS)
  if (offTarget.length > 0) {
    console.log(`Outside ${MIN_SECONDS}-${MAX_SECONDS}s: ${offTarget.map((entry) => `${entry.id} (${entry.seconds.toFixed(1)}s)`).join(', ')}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
