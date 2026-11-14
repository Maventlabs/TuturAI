'use client'

import { useEffect, useState } from 'react'

/**
 * Decodes an audio blob URL into normalized peak buckets so a waveform can be
 * drawn from the real recording instead of a decorative animation.
 */
export function useAudioPeaks(url: string | null, buckets = 48) {
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    if (!url) {
      setPeaks(null)
      setDuration(null)
      return
    }

    let cancelled = false
    const context = new AudioContext()

    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => context.decodeAudioData(buffer))
      .then((audio) => {
        if (cancelled) return
        const channel = audio.getChannelData(0)
        const bucketSize = Math.max(1, Math.floor(channel.length / buckets))
        const next: number[] = []
        for (let bucket = 0; bucket < buckets; bucket += 1) {
          const start = bucket * bucketSize
          let peak = 0
          for (let index = 0; index < bucketSize; index += 8) {
            peak = Math.max(peak, Math.abs(channel[start + index] ?? 0))
          }
          next.push(peak)
        }
        const max = Math.max(...next, 0.0001)
        setPeaks(next.map((value) => value / max))
        setDuration(audio.duration)
      })
      .catch(() => {
        if (cancelled) return
        setPeaks(null)
        setDuration(null)
      })

    return () => {
      cancelled = true
      void context.close()
    }
  }, [url, buckets])

  return { peaks, duration }
}
