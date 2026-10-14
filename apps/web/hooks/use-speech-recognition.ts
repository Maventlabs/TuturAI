'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Browser speech recognition (Web Speech API) used as the primary transcription
 * path so speaking does not depend on an external STT tunnel/API.
 *
 * Supported in Chromium-based desktop browsers and Android Chrome. Safari and
 * Firefox do not expose it; callers must fall back to server-side STT there.
 *
 * Privacy note: in Chrome the audio is processed by the browser vendor's
 * speech service. The app's own cookies and session are not attached to that
 * request. `supported` reflects feature detection only, never a permission
 * grant.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: {
    readonly length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function resolveConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type SpeechRecognitionStatus = 'idle' | 'listening' | 'unsupported' | 'error'

export interface SpeechRecognitionResult {
  transcript: string
  /** Wall-clock milliseconds spent listening, measured by this hook. */
  durationMs: number
  confidence: number | null
}

export interface UseSpeechRecognition {
  supported: boolean
  status: SpeechRecognitionStatus
  /** Interim text while speaking, for live feedback. */
  interimTranscript: string
  start: () => boolean
  stop: () => void
  reset: () => void
  /** Resolves once recognition finishes; null when nothing was captured. */
  result: SpeechRecognitionResult | null
  errorMessage: string | null
}

export function useSpeechRecognition(lang = 'en-US'): UseSpeechRecognition {
  const Ctor = resolveConstructor()
  const supported = Ctor !== null

  const [status, setStatus] = useState<SpeechRecognitionStatus>(supported ? 'idle' : 'unsupported')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [result, setResult] = useState<SpeechRecognitionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalPartsRef = useRef<string[]>([])
  const startedAtRef = useRef(0)
  const stopRequestedRef = useRef(false)

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (!Ctor) {
      setStatus('unsupported')
      setErrorMessage('Browser ini tidak mendukung pengenalan suara.')
      return false
    }
    if (recognitionRef.current) return false

    setResult(null)
    setErrorMessage(null)
    setInterimTranscript('')
    finalPartsRef.current = []
    stopRequestedRef.current = false
    startedAtRef.current = Date.now()

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const alternative = result[0]
        if (!alternative) continue
        if (result.isFinal) finalPartsRef.current.push(alternative.transcript.trim())
        else interim += alternative.transcript
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      // `aborted` is the normal result of an explicit stop(); not an error state.
      if (event.error === 'aborted' && stopRequestedRef.current) return
      const messages: Record<string, string> = {
        'not-allowed': 'Izin mikrofon ditolak browser.',
        'service-not-allowed': 'Layanan pengenalan suara tidak diizinkan oleh browser.',
        'no-speech': 'Tidak ada suara yang terdeteksi.',
        network: 'Jaringan pengenalan suara gagal.',
        'audio-capture': 'Mikrofon tidak dapat diakses.',
      }
      setStatus('error')
      setErrorMessage(messages[event.error] ?? 'Pengenalan suara gagal.')
    }

    recognition.onend = () => {
      recognitionRef.current = null
      if (!stopRequestedRef.current) {
        setStatus('idle')
        return
      }
      const transcript = finalPartsRef.current.join(' ').replace(/\s+/g, ' ').trim()
      const durationMs = Math.max(0, Date.now() - startedAtRef.current)
      setStatus('idle')
      setInterimTranscript('')
      setResult(transcript ? { transcript, durationMs, confidence: null } : null)
    }

    try {
      recognition.start()
    } catch {
      setStatus('error')
      setErrorMessage('Pengenalan suara gagal dimulai.')
      return false
    }

    recognitionRef.current = recognition
    setStatus('listening')
    return true
  }, [Ctor, lang])

  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    stopRequestedRef.current = true
    recognitionRef.current.stop()
  }, [])

  const reset = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    stopRequestedRef.current = false
    finalPartsRef.current = []
    startedAtRef.current = 0
    setStatus(Ctor ? 'idle' : 'unsupported')
    setInterimTranscript('')
    setResult(null)
    setErrorMessage(null)
  }, [Ctor])

  return { supported, status, interimTranscript, start, stop, reset, result, errorMessage }
}