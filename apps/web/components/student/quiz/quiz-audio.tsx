'use client'

import { useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonoLabel } from '@/components/student/practice/practice-ui'

function clock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Player for the recorded listening bank. The recording is a static file, so
 * the exam never depends on a TTS provider at runtime. Seeking is disabled on
 * purpose: the item is a listening task, not a scrubber.
 */
export function QuizAudio({ src, title }: { src: string; title?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [plays, setPlays] = useState(0)
  const [failed, setFailed] = useState(false)

  // Callers pass a per-question `key`, so a new recording remounts this player
  // with fresh state instead of resetting it from an effect.
  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio
        .play()
        .then(() => {
          setPlaying(true)
          setPlays((count) => count + 1)
        })
        .catch(() => setFailed(true))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  function restart() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    setElapsed(0)
    void audio
      .play()
      .then(() => {
        setPlaying(true)
        setPlays((count) => count + 1)
      })
      .catch(() => setFailed(true))
  }

  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0

  return (
    <div className="border border-rule bg-secondary/40">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2">
        <MonoLabel>Audio · {title ?? 'Rekaman'}</MonoLabel>
        <MonoLabel className="tabular-nums">
          {plays}× diputar
        </MonoLabel>
      </div>

      <div className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Jeda audio' : 'Putar audio'}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </button>

        <div className="min-w-0 flex-1">
          <div
            className="h-[6px] w-full overflow-hidden rounded-[1px] bg-border"
            role="progressbar"
            aria-label="Progres audio"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span className="block h-full bg-primary transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] tabular-nums leading-none text-muted-foreground">
            <span>{clock(elapsed)}</span>
            <span>{duration > 0 ? clock(duration) : '--:--'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={restart}
          aria-label="Putar ulang dari awal"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-sm border border-rule text-muted-foreground transition-colors',
            'hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {failed ? (
        <p role="alert" className="border-t border-rule px-3 py-2 text-[11px] leading-relaxed text-destructive">
          Audio tidak dapat diputar. Periksa koneksi lalu tekan putar lagi.
        </p>
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false)
          setElapsed(0)
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => setFailed(true)}
        className="sr-only"
      />
    </div>
  )
}
