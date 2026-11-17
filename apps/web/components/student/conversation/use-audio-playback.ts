'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AudioPlaybackController {
  playing: boolean
  /** Live 0..1 energy of the audio that is actually playing. */
  levelRef: { current: number }
  /** Creates and resumes the audio graph inside a user gesture. */
  prime: () => void
  play: (url: string) => Promise<boolean>
  stop: () => void
}

type AudioContextConstructor = typeof AudioContext

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ??
    null
  )
}

/**
 * Plays one tutor reply at a time and exposes the real playback energy so the
 * orb reacts to the voice instead of a simulated animation.
 */
export function useAudioPlayback(onEnded?: () => void): AudioPlaybackController {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frameRef = useRef<number | null>(null)
  const levelRef = useRef(0)
  const endedRef = useRef(onEnded)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    endedRef.current = onEnded
  }, [onEnded])

  const stopMeter = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    levelRef.current = 0
  }, [])

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current

    const audio = new Audio()
    audio.preload = 'auto'
    audio.addEventListener('ended', () => {
      stopMeter()
      setPlaying(false)
      endedRef.current?.()
    })
    audio.addEventListener('error', () => {
      stopMeter()
      setPlaying(false)
      endedRef.current?.()
    })
    audioRef.current = audio
    return audio
  }, [stopMeter])

  const prime = useCallback(() => {
    const audio = ensureAudio()
    if (analyserRef.current) {
      void contextRef.current?.resume().catch(() => {})
      return
    }

    const AudioCtx = getAudioContextConstructor()
    if (!AudioCtx) return

    try {
      const context = new AudioCtx()
      const source = context.createMediaElementSource(audio)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      analyser.connect(context.destination)
      contextRef.current = context
      analyserRef.current = analyser
      void context.resume().catch(() => {})
    } catch {
      // Playback still works without the analyser; the orb falls back to idle motion.
    }
  }, [ensureAudio])

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let index = 0; index < data.length; index += 1) {
        const value = (data[index] - 128) / 128
        sum += value * value
      }
      levelRef.current = Math.min(1, Math.sqrt(sum / data.length) * 3.4)
      frameRef.current = requestAnimationFrame(tick)
    }

    stopMeter()
    frameRef.current = requestAnimationFrame(tick)
  }, [stopMeter])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    stopMeter()
    setPlaying(false)
  }, [stopMeter])

  const play = useCallback(
    async (url: string) => {
      const audio = ensureAudio()
      prime()
      audio.src = url
      try {
        await contextRef.current?.resume().catch(() => {})
        setPlaying(true)
        await audio.play()
        startMeter()
        return true
      } catch {
        stopMeter()
        setPlaying(false)
        return false
      }
    },
    [ensureAudio, prime, startMeter, stopMeter],
  )

  useEffect(() => {
    return () => {
      stopMeter()
      audioRef.current?.pause()
      void contextRef.current?.close().catch(() => {})
      contextRef.current = null
      analyserRef.current = null
    }
  }, [stopMeter])

  return { playing, levelRef, prime, play, stop }
}
