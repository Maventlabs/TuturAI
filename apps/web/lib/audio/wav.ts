/**
 * Minimal RIFF/WAVE codec shared by the browser recorder and the server-side
 * acoustic analyser.
 *
 * The recorder captures raw PCM so the server can measure the real signal
 * (noise floor, speech duration, pauses, pitch) instead of trusting numbers the
 * client reports. Encoding is a container conversion only — no analysis happens
 * in the browser.
 */

export class WavDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WavDecodeError'
  }
}

export interface DecodedWav {
  sampleRate: number
  /** Mono samples in -1..1. Multi-channel input is averaged. */
  samples: Float32Array
}

const HEADER_BYTES = 44

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index))
  }
}

/** Encodes mono float samples as 16-bit PCM WAV. */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('A positive sample rate is required')
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = HEADER_BYTES
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return new Uint8Array(buffer)
}

function readAscii(view: DataView, offset: number, length: number) {
  let text = ''
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(view.getUint8(offset + index))
  return text
}

/**
 * Decodes PCM (8/16/24/32-bit integer) and 32-bit float WAV into mono floats.
 * Anything else — compressed containers, malformed headers — fails explicitly so
 * the caller can reject the upload instead of scoring silence.
 */
export function decodeWavPcm16(bytes: Uint8Array): DecodedWav {
  if (bytes.byteLength < HEADER_BYTES) throw new WavDecodeError('Audio file is too small to be a WAV recording')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new WavDecodeError('Audio file is not a WAV recording')
  }

  let audioFormat = 0
  let channels = 0
  let sampleRate = 0
  let bitsPerSample = 0
  let dataOffset = -1
  let dataLength = 0

  let cursor = 12
  while (cursor + 8 <= bytes.byteLength) {
    const chunkId = readAscii(view, cursor, 4)
    const chunkSize = view.getUint32(cursor + 4, true)
    const body = cursor + 8
    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || body + 16 > bytes.byteLength) throw new WavDecodeError('WAV format chunk is truncated')
      audioFormat = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bitsPerSample = view.getUint16(body + 14, true)
    } else if (chunkId === 'data') {
      dataOffset = body
      dataLength = Math.min(chunkSize, bytes.byteLength - body)
    }
    cursor = body + chunkSize + (chunkSize % 2)
  }

  if (!sampleRate || !channels) throw new WavDecodeError('WAV format chunk is missing')
  if (dataOffset < 0 || dataLength <= 0) throw new WavDecodeError('WAV data chunk is missing')
  const isFloat = audioFormat === 3
  if (!isFloat && audioFormat !== 1) throw new WavDecodeError('Only uncompressed PCM WAV audio is supported')
  if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
    throw new WavDecodeError('Unsupported WAV bit depth')
  }

  const bytesPerSample = bitsPerSample / 8
  const frameBytes = bytesPerSample * channels
  const frameCount = Math.floor(dataLength / frameBytes)
  if (frameCount <= 0) throw new WavDecodeError('WAV recording contains no audio frames')

  const samples = new Float32Array(frameCount)
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = dataOffset + frame * frameBytes + channel * bytesPerSample
      if (isFloat && bitsPerSample === 32) {
        sum += view.getFloat32(offset, true)
      } else if (bitsPerSample === 8) {
        sum += (view.getUint8(offset) - 128) / 128
      } else if (bitsPerSample === 16) {
        sum += view.getInt16(offset, true) / 0x8000
      } else if (bitsPerSample === 24) {
        const low = view.getUint8(offset)
        const mid = view.getUint8(offset + 1)
        const high = view.getInt8(offset + 2)
        sum += ((high << 16) | (mid << 8) | low) / 0x800000
      } else {
        sum += view.getInt32(offset, true) / 0x80000000
      }
    }
    samples[frame] = sum / channels
  }

  return { sampleRate, samples }
}

/** Linear resampling, used only when the browser cannot open a 16 kHz context. */
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples
  const ratio = fromRate / toRate
  const length = Math.max(1, Math.floor(samples.length / ratio))
  const output = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio
    const left = Math.floor(position)
    const right = Math.min(samples.length - 1, left + 1)
    const weight = position - left
    output[index] = samples[left] * (1 - weight) + samples[right] * weight
  }
  return output
}
