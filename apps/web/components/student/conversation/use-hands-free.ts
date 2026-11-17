'use client'

import { useEffect, useRef, useState } from 'react'

const SPEECH_THRESHOLD = 0.05
const SILENCE_MS = 1_100
const MIN_SPEECH_MS = 350
const MAX_UTTERANCE_MS = 25_000

export interface HandsFreeOptions {
  /** True only while the microphone is open and the tutor is not speaking. */
  active: boolean
  volumeRef: { current: number }
  onUtteranceEnd: () => void
}

/**
 * Segments a continuous microphone stream into utterances. A short pause is
 * not treated as the end of a sentence: the turn closes only after a sustained
 * silence, so a thinking pause does not cut the student off mid-answer.
 */
export function useHandsFree({ active, volumeRef, onUtteranceEnd }: HandsFreeOptions) {
  const [speaking, setSpeaking] = useState(false)
  const callbackRef = useRef(onUtteranceEnd)

  useEffect(() => {
    callbackRef.current = onUtteranceEnd
  }, [onUtteranceEnd])

  useEffect(() => {
    if (!active) return

    let frame = 0
    let speechStartedAt = 0
    let lastVoiceAt = 0
    let isSpeaking = false
    let emitted = true

    const tick = () => {
      const now = performance.now()
      const level = volumeRef.current

      if (level > SPEECH_THRESHOLD) {
        if (!isSpeaking) {
          isSpeaking = true
          speechStartedAt = now
        }
        lastVoiceAt = now
      } else if (isSpeaking) {
        const silentFor = now - lastVoiceAt
        const spokenFor = now - speechStartedAt
        const finished = silentFor > SILENCE_MS && spokenFor > MIN_SPEECH_MS
        if (finished || spokenFor > MAX_UTTERANCE_MS) {
          isSpeaking = false
          if (emitted !== isSpeaking) {
            emitted = isSpeaking
            setSpeaking(false)
          }
          callbackRef.current()
          return
        }
      }

      if (emitted !== isSpeaking) {
        emitted = isSpeaking
        setSpeaking(isSpeaking)
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, volumeRef])

  return { speaking: active && speaking }
}
