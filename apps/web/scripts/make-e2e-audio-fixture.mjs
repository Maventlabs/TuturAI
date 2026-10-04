import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The production speaking/pronunciation suites replay a real speech WAV through
 * Chromium's fake microphone (`--use-file-for-fake-audio-capture`). `*.wav` is
 * gitignored, so the fixture is generated rather than committed. The sentence
 * below MUST stay identical to `E2E_EXPECTED_TEXT` in `.env.e2e.production`:
 * the suite asserts the provider transcribes this exact wording.
 */
export const E2E_AUDIO_TEXT = 'Hello, this is a short English sentence recorded for the speaking test.'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const TARGET = resolve(ROOT, 'apps/web/tests/fixtures/e2e-speaking-target.wav')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error?.code === 'ENOENT') return { available: false }
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`)
  }
  return { available: true, stdout: result.stdout ?? '' }
}

/** Synthesize offline with the Windows SAPI voice so no network or API key is involved. */
function synthesizeWindows(rawPath) {
  const script = [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.Speech',
    "$voice = (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices()",
    "$voice = $voice | Where-Object { $_.Enabled } | Select-Object -First 1",
    "if (-not $voice) { throw 'No enabled SAPI voice is installed.' }",
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$synth.SelectVoice($voice.VoiceInfo.Name)',
    '$synth.Rate = -1',
    `$synth.SetOutputToWaveFile('${rawPath}')`,
    `$synth.Speak('${E2E_AUDIO_TEXT}')`,
    '$synth.Dispose()',
  ].join('; ')
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
}

/** Chromium's fake audio source is happiest with 48 kHz mono 16-bit PCM. */
function normalize(rawPath, targetPath) {
  const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels', '-of', 'csv=p=0', rawPath])
  if (!probe.available) return rawPath
  const normalized = targetPath.replace(/\.wav$/, '-48k.wav')
  const converted = run('ffmpeg', ['-v', 'error', '-y', '-i', rawPath, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', normalized])
  return converted.available ? normalized : rawPath
}

if (process.platform !== 'win32') {
  throw new Error(`This generator uses the offline Windows SAPI voice and cannot run on ${process.platform}. Record a ${E2E_AUDIO_TEXT} WAV at ${TARGET} instead.`)
}

mkdirSync(dirname(TARGET), { recursive: true })
const rawPath = resolve(ROOT, 'apps/web/tests/fixtures/e2e-speaking-target-raw.wav')
synthesizeWindows(rawPath)
const finalPath = normalize(rawPath, TARGET)
if (finalPath !== rawPath) renameSync(finalPath, TARGET)
rmSync(rawPath, { force: true })

if (!existsSync(TARGET) || statSync(TARGET).size < 1024) throw new Error('Audio fixture generation produced no usable WAV.')
console.log(JSON.stringify({ fixture: TARGET, bytes: statSync(TARGET).size, text: E2E_AUDIO_TEXT }))