'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, RotateCcw, Sparkles, Volume2, Bot } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VoiceOrb, type OrbState } from '@/components/student/ai-tutor/voice-orb'
import { useMicrophone } from '@/hooks/use-microphone'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'recording' | 'processing' | 'playing' | 'error'

type TtsMeter = {
  ctx: AudioContext
  analyser: AnalyserNode
  raf: number
  level: number
}

export default function LatihanBicaraAIPage() {
  const mic = useMicrophone()
  const recording = mic.status === 'recording'
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [aiText, setAiText] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const meterRef = useRef<TtsMeter | null>(null)

  const stopMeter = useCallback(() => {
    const meter = meterRef.current
    if (!meter) return
    cancelAnimationFrame(meter.raf)
    meter.ctx.close().catch(() => {})
    meterRef.current = null
  }, [])

  /**
   * Taps the spoken reply so the orb reacts to the real voice output instead of
   * a simulated animation. Playback still works if the analyser cannot attach.
   */
  const startMeter = useCallback(
    (audio: HTMLAudioElement) => {
      stopMeter()
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return

      try {
        const ctx = new AudioCtx()
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        analyser.connect(ctx.destination)
        void ctx.resume().catch(() => {})

        const data = new Uint8Array(analyser.fftSize)
        const meter: TtsMeter = { ctx, analyser, raf: 0, level: 0 }
        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let index = 0; index < data.length; index++) {
            const value = (data[index] - 128) / 128
            sum += value * value
          }
          meter.level = Math.min(1, Math.sqrt(sum / data.length) * 3.4)
          meter.raf = requestAnimationFrame(tick)
        }
        meter.raf = requestAnimationFrame(tick)
        meterRef.current = meter
      } catch {
        // The orb falls back to its idle motion; audio playback is unaffected.
      }
    },
    [stopMeter],
  )

  useEffect(() => {
    return () => {
      stopMeter()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioRef.current?.pause()
    }
  }, [stopMeter])

  useEffect(() => {
    if (!mic.audioBlob || recording) return
    const audioBlob = mic.audioBlob

    const sendToBackend = async () => {
      setStatus('processing')
      setError(null)
      setAiText(null)

      try {
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')

        const response = await fetch('/api/student/latihan-bicara-ai', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error?.message ?? 'Gagal memproses audio.')
        }

        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('audio/')) {
          const blob = await response.blob()
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = URL.createObjectURL(blob)
          const audio = new Audio(audioUrlRef.current)
          audioRef.current = audio
          audio.onended = () => {
            stopMeter()
            setStatus('idle')
          }
          audio.onerror = () => {
            stopMeter()
            setStatus('error')
            setError('Gagal memutar audio balasan.')
          }
          setStatus('playing')
          startMeter(audio)
          await audio.play()
        } else {
          const payload = await response.json()
          setAiText(payload.data?.text ?? payload.data?.feedback ?? 'Respons diterima.')
          setStatus('idle')
        }
      } catch (cause) {
        setStatus('error')
        setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan. Coba lagi.')
      }
    }

    void sendToBackend()
  }, [mic.audioBlob, recording, startMeter, stopMeter])

  const isBusy = status === 'processing' || status === 'playing'
  const micBlocked = mic.status === 'requesting' || mic.status === 'denied' || mic.status === 'unsupported'

  async function toggleRecord() {
    if (recording) {
      mic.stop()
      return
    }
    stopMeter()
    audioRef.current?.pause()
    mic.reset()
    setError(null)
    setAiText(null)
    setStatus('idle')
    const started = await mic.start()
    console.log('[v0] mic start result:', started)
    setStatus(started ? 'recording' : 'error')
  }

  function resetAll() {
    stopMeter()
    audioRef.current?.pause()
    mic.reset()
    setAiText(null)
    setError(null)
    setStatus('idle')
  }

  const orbState: OrbState =
    status === 'recording'
      ? 'listening'
      : status === 'processing'
        ? 'thinking'
        : status === 'playing'
          ? 'speaking'
          : status === 'error'
            ? 'error'
            : 'idle'

  const getLevel = useCallback(() => {
    if (status === 'recording') return mic.volumeRef.current
    if (status === 'playing') return meterRef.current?.level ?? 0
    return 0
  }, [status, mic.volumeRef])

  const statusLabel =
    status === 'recording'
      ? `Merekam · ${String(Math.floor(mic.seconds / 60)).padStart(2, '0')}:${String(mic.seconds % 60).padStart(2, '0')}`
      : status === 'processing'
        ? 'AI sedang menilai'
        : status === 'playing'
          ? 'AI sedang berbicara'
          : status === 'error'
            ? 'Terjadi kesalahan'
            : 'Siap mendengarkan'

  const hint =
    status === 'recording'
      ? 'Bicara dengan jelas. Ketuk orb lagi kalau sudah selesai.'
      : status === 'processing'
        ? 'Mentranskripsi dan menilai pelafalanmu…'
        : status === 'playing'
          ? 'Dengarkan respons AI, lalu lanjutkan percakapan.'
          : status === 'error'
            ? (error ?? mic.errorMessage ?? 'Coba lagi.')
            : 'Ketuk orb atau tombol mikrofon, lalu bicara dalam Bahasa Inggris.'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Latihan Bicara AI"
        description="Latih percakapan Bahasa Inggris dengan AI Coach. Ketuk orb untuk mulai, ketuk lagi untuk selesai."
      />

      <Card className="relative overflow-hidden">
        <div className="flex flex-col items-center px-6 pb-8 pt-8 sm:pt-10">
          <button
            type="button"
            onClick={toggleRecord}
            disabled={isBusy || micBlocked}
            aria-label={recording ? 'Hentikan rekaman' : 'Mulai rekaman'}
            className={cn(
              'relative h-60 w-60 rounded-full outline-none transition-transform duration-300',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card',
              'disabled:cursor-not-allowed sm:h-72 sm:w-72',
              !isBusy && !micBlocked && 'hover:scale-[1.02] active:scale-[0.99]',
            )}
          >
            <VoiceOrb state={orbState} getLevel={getLevel} />
          </button>

          <div className="mt-5 flex min-h-11 flex-col items-center gap-1 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {statusLabel}
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">{hint}</p>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button
              onClick={toggleRecord}
              disabled={isBusy || micBlocked}
              variant={recording ? 'destructive' : 'default'}
              className="gap-2"
            >
              {mic.status === 'requesting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Meminta izin
                </>
              ) : recording ? (
                <>
                  <Square className="h-4 w-4 fill-current" />
                  Selesai
                </>
              ) : isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Tunggu
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Mulai bicara
                </>
              )}
            </Button>

            {(aiText || status === 'error' || mic.audioBlob) && !isBusy && (
              <Button variant="ghost" onClick={resetAll} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Ulangi
              </Button>
            )}
          </div>

          {status === 'playing' && (
            <p className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5 animate-pulse text-primary" />
              Memutar respons AI
            </p>
          )}

          {mic.errorMessage && !recording && (
            <p role="alert" className="mt-4 text-xs text-destructive">
              {mic.errorMessage}
            </p>
          )}
        </div>
      </Card>

      {aiText && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">AI Coach</p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{aiText}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Tips</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Bicara dengan jelas dan natural. AI akan merespons dalam 2-3 kalimat dan memberikan
              evaluasi pelafalan/tata bahasa secara halus. Jangan ragu untuk merekam ulang!
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
