'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeWavPcm16, resampleLinear } from './wav'

/**
 * Microphone capture for Speaking Practice.
 *
 * Records raw PCM through a ScriptProcessorNode and encodes a 16 kHz mono WAV in
 * the browser, so the server can measure the real signal instead of trusting
 * client-reported numbers. The level bars are driven by an AnalyserNode reading
 * the live input — they are a measurement of the microphone, not decoration.
 */

const TARGET_SAMPLE_RATE = 16_000
const BAR_COUNT = 32
const PROCESSOR_BUFFER = 4096

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'ready' | 'denied' | 'unsupported' | 'error'

export interface PcmRecorder {
  status: RecorderStatus
  seconds: number
  levels: number[]
  wavBlob: Blob | null
  audioUrl: string | null
  errorMessage: string | null
  start: () => Promise<boolean>
  stop: () => void
  reset: () => void
}

function emptyLevels() {
  return Array.from({ length: BAR_COUNT }, () => 0)
}

export function usePcmRecorder(): PcmRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [seconds, setSeconds] = useState(0)
  const [levels, setLevels] = useState<number[]>(emptyLevels)
  const [wavBlob, setWavBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const frameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const urlRef = useRef<string | null>(null)

  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    if (timerRef.current !== null) clearInterval(timerRef.current)
    timerRef.current = null
    processorRef.current?.disconnect()
    processorRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') void context.close()
  }, [])

  const reset = useCallback(() => {
    teardown()
    chunksRef.current = []
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setAudioUrl(null)
    setWavBlob(null)
    setSeconds(0)
    setLevels(emptyLevels())
    setErrorMessage(null)
    setStatus('idle')
  }, [teardown])

  useEffect(() => () => {
    teardown()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [teardown])

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setErrorMessage('This browser cannot access the microphone. Try Chrome, Edge, or Safari on a laptop.')
      return false
    }

    reset()
    setStatus('requesting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      setErrorMessage(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access was blocked. Allow the microphone in your browser settings, then try again.'
          : 'The microphone could not be started. Check that no other app is using it, then try again.',
      )
      return false
    }

    streamRef.current = stream
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) {
      teardown()
      setStatus('unsupported')
      setErrorMessage('This browser cannot record audio. Try Chrome, Edge, or Safari on a laptop.')
      return false
    }

    let context: AudioContext
    try {
      context = new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE })
    } catch {
      context = new AudioContextClass()
    }
    contextRef.current = context
    if (context.state === 'suspended') await context.resume()

    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)
    analyserRef.current = analyser

    const processor = context.createScriptProcessor(PROCESSOR_BUFFER, 1, 1)
    const mute = context.createGain()
    mute.gain.value = 0
    source.connect(processor)
    processor.connect(mute)
    mute.connect(context.destination)
    processorRef.current = processor
    chunksRef.current = []

    processor.onaudioprocess = (event) => {
      chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }

    const frequency = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(frequency)
      const bucket = Math.max(1, Math.floor(frequency.length / BAR_COUNT))
      const next: number[] = []
      for (let bar = 0; bar < BAR_COUNT; bar += 1) {
        let sum = 0
        for (let index = 0; index < bucket; index += 1) sum += frequency[bar * bucket + index] ?? 0
        next.push(Math.min(1, sum / bucket / 190))
      }
      setLevels(next)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    startedAtRef.current = Date.now()
    setSeconds(0)
    timerRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 200)

    setStatus('recording')
    return true
  }, [reset, teardown])

  const stop = useCallback(() => {
    const context = contextRef.current
    const chunks = chunksRef.current
    const sampleRate = context?.sampleRate ?? TARGET_SAMPLE_RATE
    teardown()

    if (chunks.length === 0) {
      setStatus('error')
      setErrorMessage('No audio was captured. Check your microphone and record again.')
      return
    }

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    chunksRef.current = []

    const samples = sampleRate === TARGET_SAMPLE_RATE ? merged : resampleLinear(merged, sampleRate, TARGET_SAMPLE_RATE)
    const wav = encodeWavPcm16(samples, TARGET_SAMPLE_RATE)
    const blob = new Blob([wav], { type: 'audio/wav' })
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url

    setWavBlob(blob)
    setAudioUrl(url)
    setLevels(emptyLevels())
    setStatus('ready')
  }, [teardown])

  return { status, seconds, levels, wavBlob, audioUrl, errorMessage, start, stop, reset }
}
