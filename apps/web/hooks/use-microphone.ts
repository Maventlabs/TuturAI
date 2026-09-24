'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type MicStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'denied'
  | 'unsupported'
  | 'error'

interface UseMicrophoneResult {
  status: MicStatus
  /** Normalized 0..1 levels for live waveform bars. */
  levels: number[]
  /** Overall input volume 0..1, useful for a pulsing ring. */
  volume: number
  /** Seconds elapsed in the current recording. */
  seconds: number
  /** Blob URL of the last completed recording, or null. */
  audioUrl: string | null
  audioBlob: Blob | null
  errorMessage: string | null
  start: () => Promise<void>
  stop: () => void
  reset: () => void
}

const BAR_COUNT = 28

export function useMicrophone(): UseMicrophoneResult {
  const [status, setStatus] = useState<MicStatus>('idle')
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0))
  const [volume, setVolume] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<(() => void) | null>(null)

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        /* noop */
      }
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
    }
    audioCtxRef.current = null
    analyserRef.current = null
  }, [])

  // Clean up on unmount.
  useEffect(() => cleanup, [cleanup])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)

    // Down-sample the frequency bins into BAR_COUNT bars.
    const step = Math.floor(data.length / BAR_COUNT) || 1
    const next: number[] = []
    let sum = 0
    for (let i = 0; i < BAR_COUNT; i++) {
      const v = data[i * step] / 255
      next.push(v)
      sum += v
    }
    setLevels(next)
    setVolume(sum / BAR_COUNT)
    rafRef.current = requestAnimationFrame(() => tickRef.current?.())
  }, [])

  useEffect(() => {
    tickRef.current = tick
    return () => {
      tickRef.current = null
    }
  }, [tick])

  const start = useCallback(async () => {
    setErrorMessage(null)
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === 'undefined' ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      setStatus('unsupported')
      setErrorMessage('Browser kamu tidak mendukung perekaman audio.')
      return
    }

    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Audio analysis pipeline.
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      analyserRef.current = analyser

      // Recorder.
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setAudioBlob(blob)
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      }
      recorder.start()
      recorderRef.current = recorder

      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      setStatus('recording')
       rafRef.current = requestAnimationFrame(() => tickRef.current?.())
    } catch (err) {
      const e = err as DOMException
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setStatus('denied')
        setErrorMessage(
          'Akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser untuk merekam.',
        )
      } else if (e.name === 'NotFoundError') {
        setStatus('error')
        setErrorMessage('Mikrofon tidak ditemukan. Sambungkan mikrofon lalu coba lagi.')
      } else {
        setStatus('error')
        setErrorMessage('Gagal mengakses mikrofon. Coba lagi.')
      }
      cleanup()
    }
  }, [cleanup])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        /* noop */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
    }
    audioCtxRef.current = null
    analyserRef.current = null
    setLevels(new Array(BAR_COUNT).fill(0))
    setVolume(0)
    setStatus('idle')
  }, [])

  const reset = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setAudioBlob(null)
    setSeconds(0)
    setLevels(new Array(BAR_COUNT).fill(0))
    setVolume(0)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  return {
    status,
    levels,
    volume,
    seconds,
    audioUrl,
    audioBlob,
    errorMessage,
    start,
    stop,
    reset,
  }
}
