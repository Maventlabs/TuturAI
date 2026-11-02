'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, Volume2, Bot, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Waveform } from '@/components/dashboard/waveform'
import { useMicrophone } from '@/hooks/use-microphone'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'recording' | 'processing' | 'playing' | 'error'

export default function LatihanBicaraAIPage() {
  const mic = useMicrophone()
  const recording = mic.status === 'recording'
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [aiText, setAiText] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioRef.current?.pause()
    }
  }, [])

  // When recording stops and we have a blob, send to backend
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
          audio.onended = () => setStatus('idle')
          audio.onerror = () => {
            setStatus('error')
            setError('Gagal memutar audio balasan.')
          }
          setStatus('playing')
          await audio.play()
        } else {
          // JSON response (text fallback)
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
  }, [mic.audioBlob, recording])

  async function toggleRecord() {
    if (recording) {
      mic.stop()
      return
    }
    // Reset state
    mic.reset()
    setError(null)
    setAiText(null)
    setStatus('idle')
    await mic.start()
    setStatus('recording')
  }

  const isBusy = status === 'processing' || status === 'playing'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Latihan Bicara AI"
        description="Latih percakapan Bahasa Inggris dengan AI Coach. Klik tombol mikrofon untuk mulai, klik lagi untuk selesai."
      />

      <Card className="flex flex-col items-center gap-6 p-8 sm:p-12">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <Badge
            variant={status === 'recording' ? 'destructive' : status === 'processing' ? 'secondary' : 'default'}
            className="gap-1.5"
          >
            {status === 'idle' && 'Siap'}
            {status === 'recording' && (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                Merekam...
              </>
            )}
            {status === 'processing' && 'Memproses...'}
            {status === 'playing' && 'AI merespons...'}
            {status === 'error' && 'Error'}
          </Badge>
        </div>

        {/* Waveform */}
        {recording && (
          <div className="w-full">
            <Waveform active levels={mic.levels} bars={24} className="h-16" />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {String(Math.floor(mic.seconds / 60)).padStart(2, '0')}:
              {String(mic.seconds % 60).padStart(2, '0')}
            </p>
          </div>
        )}

        {/* Main record button */}
        <div className="relative">
          {recording && (
            <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-pulse" />
          )}
          <Button
            size="lg"
            onClick={toggleRecord}
            disabled={isBusy || mic.status === 'requesting' || mic.status === 'denied' || mic.status === 'unsupported'}
            className={cn(
              'relative h-24 w-24 rounded-full text-white shadow-lg transition-all',
              recording
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-primary hover:bg-primary/90',
              isBusy && 'cursor-not-allowed opacity-70',
            )}
            aria-label={recording ? 'Hentikan rekaman' : 'Mulai rekaman'}
          >
            {mic.status === 'requesting' ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : recording ? (
              <Square className="h-10 w-10 fill-current" />
            ) : isBusy ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </Button>
        </div>

        {/* Hint text */}
        <p className="text-center text-sm text-muted-foreground">
          {status === 'idle' && !mic.audioBlob && 'Klik tombol mikrofon untuk mulai berbicara'}
          {status === 'recording' && 'Klik lagi untuk selesai dan kirim ke AI'}
          {status === 'processing' && 'AI sedang mendengarkan dan menganalisis...'}
          {status === 'playing' && 'Dengarkan respons AI...'}
          {status === 'error' && error}
        </p>

        {/* Error message */}
        {error && status === 'error' && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* AI text response (if JSON fallback) */}
        <div>
          {aiText && (
            <div className="w-full">
              <Card className="border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-primary">AI Coach</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{aiText}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Playing indicator */}
        {status === 'playing' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Volume2 className="h-4 w-4 animate-pulse text-primary" />
            <span>Memutar respons AI...</span>
          </div>
        )}

        {/* Mic error */}
        {mic.errorMessage && !recording && (
          <p className="text-xs text-destructive">{mic.errorMessage}</p>
        )}
      </Card>

      {/* Tips */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Tips</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bicara dengan jelas dan natural. AI akan merespons dalam 2-3 kalimat dan memberikan evaluasi pelafalan/tata bahasa secara halus. Jangan ragu untuk merekam ulang!
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
