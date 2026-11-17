'use client'

import { ArrowLeft, Loader2, Mic, RotateCcw, Square, Wand2 } from 'lucide-react'
import { SPEAKING_SESSION_TYPES, type SpeakingScenarioBrief, type SpeakingSessionType } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { MonoLabel, Panel, PanelHeader, StatusLine } from '@/components/student/practice/practice-ui'
import type { PcmRecorder } from '@/lib/audio/use-pcm-recorder'
import { cn } from '@/lib/utils'

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function RecordingStage({
  scenario,
  sessionType,
  recorder,
  submitting,
  error,
  onAnalyse,
  onBack,
}: {
  scenario: SpeakingScenarioBrief
  sessionType: SpeakingSessionType
  recorder: PcmRecorder
  submitting: boolean
  error: string | null
  onAnalyse: () => void
  onBack: () => void
}) {
  const definition = SPEAKING_SESSION_TYPES[sessionType]
  const recording = recorder.status === 'recording'
  const ready = recorder.status === 'ready' && recorder.wavBlob !== null
  const busy = recorder.status === 'requesting'
  const progress = Math.min(1, recorder.seconds / definition.maxSeconds)
  const overTarget = recorder.seconds > definition.maxSeconds

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={recording || submitting}
        className="-ml-2 gap-1.5 text-muted-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Back to brief
      </Button>

      <Panel>
        <PanelHeader
          label="Recording"
          right={
            recording ? (
              <StatusLine tone="live">Recording</StatusLine>
            ) : ready ? (
              <StatusLine tone="busy">Take ready</StatusLine>
            ) : (
              <StatusLine>Microphone idle</StatusLine>
            )
          }
        />

        <div className="space-y-6 p-5 sm:p-6">
          <div className="border-l-2 border-primary pl-3.5">
            <MonoLabel className="text-primary-deep">{scenario.title}</MonoLabel>
            <p className="mt-1.5 text-pretty font-display text-[16px] leading-snug text-foreground sm:text-[18px]">
              {scenario.question}
            </p>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <p
                className={cn(
                  'font-mono text-[44px] font-medium leading-none tabular-nums tracking-[-0.02em]',
                  recording ? 'text-foreground' : 'text-muted-foreground',
                )}
                aria-live="off"
              >
                {formatClock(recorder.seconds)}
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Target {definition.minSeconds}–{definition.maxSeconds}s
                {overTarget ? ' · over target' : ''}
              </p>
            </div>

            <div className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <span
                className={cn('block h-full transition-[width] duration-200', overTarget ? 'bg-destructive' : 'bg-primary')}
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>

            <div
              className="flex h-20 w-full max-w-md items-end justify-center gap-[3px]"
              role="img"
              aria-label={recording ? 'Live microphone level' : 'Microphone level idle'}
            >
              {recorder.levels.map((level, index) => (
                <span
                  key={index}
                  className={cn(
                    'w-full max-w-[8px] flex-1 rounded-[1px] transition-[height] duration-75',
                    recording ? 'bg-primary' : 'bg-border',
                  )}
                  style={{ height: `${Math.max(recording ? 4 : 14, level * 100)}%` }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {recording ? (
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={recorder.stop}
                  className="h-12 gap-2 rounded-full px-6"
                >
                  <Square aria-hidden="true" className="size-4 fill-current" />
                  Stop recording
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => void recorder.start()}
                  disabled={busy || submitting}
                  className="h-12 gap-2 rounded-full px-6"
                >
                  {busy ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Mic aria-hidden="true" className="size-4" />
                  )}
                  {ready ? 'Record again' : busy ? 'Requesting microphone' : 'Start recording'}
                </Button>
              )}
            </div>

            {recorder.errorMessage ? (
              <p role="alert" className="max-w-md text-center text-[12px] leading-relaxed text-destructive">
                {recorder.errorMessage}
              </p>
            ) : null}
          </div>

          {ready && recorder.audioUrl ? (
            <div className="space-y-3 border-t border-rule pt-5">
              <MonoLabel>Playback</MonoLabel>
              <audio src={recorder.audioUrl} controls className="w-full" preload="metadata">
                Your browser does not support audio playback.
              </audio>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Listen once before submitting. The recording is analysed on the server; the audio itself is not stored.
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] leading-relaxed text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <MonoLabel>{ready ? 'Ready to analyse' : 'Speak in full sentences'}</MonoLabel>
          <div className="flex w-full gap-2 sm:w-auto">
            {ready ? (
              <Button variant="outline" size="sm" onClick={recorder.reset} disabled={submitting} className="gap-1.5">
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Discard
              </Button>
            ) : null}
            <Button onClick={onAnalyse} disabled={!ready || submitting} className="flex-1 gap-2 sm:flex-none">
              {submitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Wand2 aria-hidden="true" className="size-4" />
              )}
              {submitting ? 'Analysing' : 'Analyse answer'}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
