import { describe, expect, it } from 'vitest'
import { analyzeAcousticSignal } from './acoustic-analysis'
import { decodeWavPcm16, encodeWavPcm16, resampleLinear } from './wav'

const RATE = 16_000

function tone(seconds: number, frequency: number, amplitude = 0.5) {
  const length = Math.round(seconds * RATE)
  const samples = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / RATE)
  }
  return samples
}

function silence(seconds: number) {
  return new Float32Array(Math.round(seconds * RATE))
}

function concat(...parts: Float32Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

describe('analyzeAcousticSignal', () => {
  it('reports no speech for an empty recording', () => {
    const result = analyzeAcousticSignal({ samples: new Float32Array(0), sampleRate: RATE })
    expect(result.durationMs).toBe(0)
    expect(result.speechDurationMs).toBe(0)
    expect(result.pitchPoints).toEqual([])
    expect(result.snrDb).toBeLessThan(10)
  })

  it('measures speech duration, SNR and pitch from a real signal', () => {
    const samples = concat(silence(0.3), tone(2, 150), silence(0.3))
    const result = analyzeAcousticSignal({ samples, sampleRate: RATE })

    expect(result.durationMs).toBeGreaterThan(2500)
    expect(result.speechDurationMs).toBeGreaterThan(1800)
    expect(result.speechDurationMs).toBeLessThan(2200)
    expect(result.snrDb).toBeGreaterThan(10)
    expect(result.pitchPoints.length).toBeGreaterThan(20)
    expect(result.meanF0Hz).not.toBeNull()
    expect(Math.abs((result.meanF0Hz as number) - 150)).toBeLessThan(6)
    expect(result.voicedDurationMs).toBeGreaterThan(1000)
  })

  it('measures the silence between two speech runs as a pause', () => {
    const samples = concat(silence(0.2), tone(1, 180), silence(0.5), tone(1, 180), silence(0.2))
    const result = analyzeAcousticSignal({ samples, sampleRate: RATE })

    expect(result.totalPauseDurationMs).toBeGreaterThan(400)
    expect(result.totalPauseDurationMs).toBeLessThan(620)
    expect(result.pauseRatio).toBeGreaterThan(0.1)
    expect(result.pauseRatio).toBeLessThan(0.35)
  })

  it('reports a lower SNR when noise competes with the voice', () => {
    const clean = analyzeAcousticSignal({ samples: concat(silence(0.2), tone(1.5, 200), silence(0.2)), sampleRate: RATE })
    const noisySamples = concat(silence(0.2), tone(1.5, 200), silence(0.2))
    for (let index = 0; index < noisySamples.length; index += 1) {
      noisySamples[index] += (Math.random() - 0.5) * 0.9
    }
    const noisy = analyzeAcousticSignal({ samples: noisySamples, sampleRate: RATE })

    expect(noisy.snrDb).toBeLessThan(clean.snrDb)
  })

  it('keeps pitch points inside the canonical 50–500 Hz window', () => {
    const samples = concat(silence(0.2), tone(1.2, 320), silence(0.2))
    const result = analyzeAcousticSignal({ samples, sampleRate: RATE })
    expect(result.pitchPoints.length).toBeGreaterThan(10)
    for (const point of result.pitchPoints) {
      expect(point.f0Hz).toBeGreaterThanOrEqual(50)
      expect(point.f0Hz).toBeLessThanOrEqual(500)
    }
  })
})

describe('wav codec', () => {
  it('round-trips mono PCM16 audio', () => {
    const samples = tone(0.25, 220, 0.4)
    const decoded = decodeWavPcm16(encodeWavPcm16(samples, RATE))
    expect(decoded.sampleRate).toBe(RATE)
    expect(decoded.samples.length).toBe(samples.length)
    for (let index = 0; index < samples.length; index += 97) {
      expect(Math.abs(decoded.samples[index] - samples[index])).toBeLessThan(0.001)
    }
  })

  it('rejects a non-WAV payload', () => {
    expect(() => decodeWavPcm16(new Uint8Array(64))).toThrow(/WAV/)
  })

  it('resamples to the target rate', () => {
    const samples = tone(0.5, 200)
    const resampled = resampleLinear(samples, RATE, 8_000)
    expect(resampled.length).toBe(Math.floor(samples.length / 2))
  })
})
