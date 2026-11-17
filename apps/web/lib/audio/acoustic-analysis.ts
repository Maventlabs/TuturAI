/**
 * Server-side acoustic analysis of a recorded answer.
 *
 * Everything here is measured from the decoded PCM signal: the noise floor and
 * speech frames come from short-term energy, pauses from the gaps between
 * speech runs, and the pitch contour from normalised autocorrelation. No value
 * is inferred from the transcript, and nothing is synthesised when the signal
 * does not support a measurement.
 *
 * The canonical scoring engine consumes the output through
 * `evaluateAudioQuality` (SNR / speech duration) and `scoreIntonationFromPitch`
 * (pitch points / voiced duration); this module only produces evidence.
 */

export interface PitchPoint {
  timeMs: number
  f0Hz: number
}

export interface AcousticAnalysis {
  sampleRate: number
  durationMs: number
  /** Signal-to-noise ratio in dB, measured as speech energy over the noise floor. */
  snrDb: number
  /** Total time classified as speech (energy above the adaptive threshold). */
  speechDurationMs: number
  /** Silence inside the speech span, excluding leading and trailing silence. */
  totalPauseDurationMs: number
  /** Pause time over total recording time, clamped to 0..1. */
  pauseRatio: number
  /** Time covered by frames with a confident pitch estimate. */
  voicedDurationMs: number
  pitchPoints: PitchPoint[]
  meanF0Hz: number | null
  /** Standard deviation of the contour in semitones around its median. */
  pitchVariationSemitones: number | null
  peakRms: number
}

const FRAME_SECONDS = 0.032
const HOP_SECONDS = 0.01
const MIN_PAUSE_MS = 200
const PITCH_WINDOW_SECONDS = 0.03
const PITCH_HOP_SECONDS = 0.03
const PITCH_MIN_HZ = 50
const PITCH_MAX_HZ = 500
const PITCH_MIN_CORRELATION = 0.4
const SILENCE_FLOOR = 1e-5

function frameRms(samples: Float32Array, start: number, length: number) {
  const end = Math.min(samples.length, start + length)
  if (end <= start) return 0
  let sum = 0
  for (let index = start; index < end; index += 1) sum += samples[index] * samples[index]
  return Math.sqrt(sum / (end - start))
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const position = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))
  return sorted[position]
}

function decimate(samples: Float32Array, factor: number) {
  if (factor <= 1) return samples
  const length = Math.floor(samples.length / factor)
  const output = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    let sum = 0
    for (let offset = 0; offset < factor; offset += 1) sum += samples[index * factor + offset]
    output[index] = sum / factor
  }
  return output
}

/**
 * Normalised autocorrelation pitch estimate for one window. Returns null when
 * the window is not periodic enough to be a voiced sound.
 */
function estimateF0(window: Float32Array, sampleRate: number): number | null {
  const minLag = Math.max(2, Math.floor(sampleRate / PITCH_MAX_HZ))
  const maxLag = Math.min(window.length - 2, Math.ceil(sampleRate / PITCH_MIN_HZ))
  if (maxLag <= minLag) return null

  const scores = new Float64Array(maxLag + 1)
  let bestScore = 0
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0
    let energyLeft = 0
    let energyRight = 0
    const limit = window.length - lag
    for (let index = 0; index < limit; index += 1) {
      const left = window[index]
      const right = window[index + lag]
      cross += left * right
      energyLeft += left * left
      energyRight += right * right
    }
    const denominator = Math.sqrt(energyLeft * energyRight)
    if (denominator <= 0) continue
    const score = cross / denominator
    scores[lag] = score
    if (score > bestScore) bestScore = score
  }

  if (bestScore < PITCH_MIN_CORRELATION) return null

  // A periodic signal correlates just as well at every multiple of its period, so
  // taking the global maximum reports an octave (or two) too low. The shortest lag
  // that is nearly as good as the best one is the true period.
  let bestLag = 0
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const isLocalPeak = scores[lag] >= scores[lag - 1] && scores[lag] >= scores[lag + 1]
    if (isLocalPeak && scores[lag] >= bestScore * 0.9) {
      bestLag = lag
      break
    }
  }
  if (bestLag === 0) return null
  const f0 = sampleRate / bestLag
  if (f0 < PITCH_MIN_HZ || f0 > PITCH_MAX_HZ) return null
  return f0
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const mean = values.reduce((total, value) => total + value, 0) / values.length
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function analyzeAcousticSignal(input: { samples: Float32Array; sampleRate: number }): AcousticAnalysis {
  const { samples, sampleRate } = input
  const durationMs = sampleRate > 0 ? Math.round((samples.length / sampleRate) * 1000) : 0
  const empty: AcousticAnalysis = {
    sampleRate,
    durationMs,
    snrDb: -20,
    speechDurationMs: 0,
    totalPauseDurationMs: 0,
    pauseRatio: 0,
    voicedDurationMs: 0,
    pitchPoints: [],
    meanF0Hz: null,
    pitchVariationSemitones: null,
    peakRms: 0,
  }
  if (samples.length === 0 || sampleRate <= 0) return empty

  const frameLength = Math.max(1, Math.round(sampleRate * FRAME_SECONDS))
  const hopLength = Math.max(1, Math.round(sampleRate * HOP_SECONDS))
  const hopMs = (hopLength / sampleRate) * 1000

  const frameEnergies: number[] = []
  for (let start = 0; start + frameLength <= samples.length; start += hopLength) {
    frameEnergies.push(frameRms(samples, start, frameLength))
  }
  if (frameEnergies.length === 0) return empty

  const peakRms = Math.max(...frameEnergies)
  // Silence candidates are frames well below the loudest frame. When a recording
  // has no such frames (continuous speech, no gaps) the floor is derived from the
  // peak instead of the 10th percentile, which would otherwise sit at speech level
  // and reject a perfectly good answer as "too short".
  const silenceCeiling = Math.max(0.004, peakRms * 0.05)
  const quietFrames = frameEnergies.filter((energy) => energy < silenceCeiling)
  const noiseFloor = Math.max(
    SILENCE_FLOOR,
    quietFrames.length > 0 ? percentile(quietFrames, 0.5) : silenceCeiling / 4,
  )
  const speechThreshold = Math.max(silenceCeiling, noiseFloor * 2.5)
  const isSpeech = frameEnergies.map((energy) => energy >= speechThreshold)

  const speechFrames = isSpeech.filter(Boolean).length
  const speechDurationMs = Math.round(speechFrames * hopMs)

  let speechEnergy = 0
  for (let index = 0; index < frameEnergies.length; index += 1) {
    if (isSpeech[index]) speechEnergy += frameEnergies[index] ** 2
  }
  const speechRms = speechFrames > 0 ? Math.sqrt(speechEnergy / speechFrames) : 0
  const snrDb = speechRms > 0 ? Math.max(-20, Math.min(60, 20 * Math.log10(speechRms / noiseFloor))) : -20

  // Pauses are silence runs that sit between the first and last speech frame;
  // leading and trailing silence is not a pause in the answer.
  const firstSpeech = isSpeech.indexOf(true)
  const lastSpeech = isSpeech.lastIndexOf(true)
  let totalPauseDurationMs = 0
  if (firstSpeech >= 0 && lastSpeech > firstSpeech) {
    let runStart = -1
    for (let index = firstSpeech; index <= lastSpeech; index += 1) {
      if (!isSpeech[index] && runStart < 0) runStart = index
      if ((isSpeech[index] || index === lastSpeech) && runStart >= 0) {
        const runMs = (index - runStart) * hopMs
        if (runMs >= MIN_PAUSE_MS) totalPauseDurationMs += runMs
        runStart = -1
      }
    }
  }
  const pauseRatio = durationMs > 0 ? Math.min(1, Math.max(0, totalPauseDurationMs / durationMs)) : 0

  // Pitch is estimated on a decimated copy: 8 kHz still resolves 50–500 Hz and
  // keeps the autocorrelation search cheap for 90-second answers.
  const pitchFactor = sampleRate >= 16_000 ? 2 : 1
  const pitchSamples = decimate(samples, pitchFactor)
  const pitchRate = sampleRate / pitchFactor
  const pitchWindow = Math.max(64, Math.round(pitchRate * PITCH_WINDOW_SECONDS))
  const pitchHop = Math.max(1, Math.round(pitchRate * PITCH_HOP_SECONDS))
  const pitchPoints: PitchPoint[] = []

  for (let start = 0; start + pitchWindow <= pitchSamples.length; start += pitchHop) {
    const window = pitchSamples.subarray(start, start + pitchWindow)
    const energy = frameRms(window, 0, window.length)
    if (energy < speechThreshold) continue
    const f0 = estimateF0(window, pitchRate)
    if (f0 === null) continue
    pitchPoints.push({ timeMs: Math.round((start / pitchRate) * 1000), f0Hz: Math.round(f0 * 10) / 10 })
  }

  const voicedDurationMs = Math.round(pitchPoints.length * PITCH_HOP_SECONDS * 1000)
  const meanF0Hz = pitchPoints.length > 0
    ? Math.round((pitchPoints.reduce((total, point) => total + point.f0Hz, 0) / pitchPoints.length) * 10) / 10
    : null

  let pitchVariationSemitones: number | null = null
  if (pitchPoints.length >= 2) {
    const frequencies = pitchPoints.map((point) => point.f0Hz).sort((left, right) => left - right)
    const median = frequencies[Math.floor(frequencies.length / 2)]
    const semitones = pitchPoints.map((point) => 12 * Math.log2(point.f0Hz / median))
    pitchVariationSemitones = Math.round(standardDeviation(semitones) * 100) / 100
  }

  return {
    sampleRate,
    durationMs,
    snrDb: Math.round(snrDb * 10) / 10,
    speechDurationMs,
    totalPauseDurationMs: Math.round(totalPauseDurationMs),
    pauseRatio: Math.round(pauseRatio * 1000) / 1000,
    voicedDurationMs,
    pitchPoints,
    meanF0Hz,
    pitchVariationSemitones,
    peakRms: Math.round(peakRms * 1000) / 1000,
  }
}
