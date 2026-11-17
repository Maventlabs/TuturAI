'use client'

import { useEffect, useRef } from 'react'
import { Camera, Loader2, Mic, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { LocalMedia } from './use-local-media'

function MicLevelMeter({ stream }: { stream: MediaStream | null }) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const supported =
    typeof window === 'undefined' ||
    Boolean(
      window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
    )

  useEffect(() => {
    if (!stream || !supported) return
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const context = new AudioContextCtor()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let frame = 0

    const loop = () => {
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (let index = 0; index < data.length; index += 1) {
        peak = Math.max(peak, Math.abs(data[index] - 128) / 128)
      }
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.min(1, peak * 2.6)})`
      }
      frame = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      void context.close()
    }
  }, [stream, supported])

  if (!supported) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Browser ini tidak mendukung pengujian level mikrofon.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          ref={barRef}
          className="h-full w-full origin-left rounded-full bg-success transition-transform duration-75"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {stream ? 'Bicara untuk menguji input' : 'Mikrofon mati'}
      </p>
    </div>
  )
}

function DeviceSelect({
  id,
  label,
  value,
  options,
  fallbackLabel,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string | null
  options: MediaDeviceInfo[]
  fallbackLabel: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || options.length === 0}
        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
      >
        {options.length === 0 && <option value="">{fallbackLabel}</option>}
        {options.map((device, index) => (
          <option key={device.deviceId || `device-${index}`} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  )
}

interface DeviceSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  media: LocalMedia
}

export function DeviceSettingsDialog({ open, onOpenChange, media }: DeviceSettingsDialogProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const speakerSupported =
    typeof window !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

  useEffect(() => {
    const element = previewRef.current
    if (!element) return
    element.srcObject = media.cameraStream
  }, [media.cameraStream, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pengaturan perangkat</DialogTitle>
          <DialogDescription>
            Pilih kamera dan mikrofon sebelum masuk sesi. Perubahan langsung berlaku pada pratinjau lokal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-1">
          <section className="space-y-2.5 rounded-xl bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
                <Camera className="h-3 w-3" aria-hidden />
                Kamera
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (media.cameraOn ? media.stopCamera() : void media.enableCamera(media.cameraId ?? undefined))}
                disabled={media.cameraPending}
                className="h-7 gap-1.5 px-2 text-[11px]"
              >
                {media.cameraPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {media.cameraOn ? 'Matikan' : 'Nyalakan'}
              </Button>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-lg bg-ink-deep ring-1 ring-white/10">
              {media.cameraOn ? (
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              ) : (
                <p className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  Pratinjau kamera mati
                </p>
              )}
            </div>

            <DeviceSelect
              id="camera-device"
              label="Pilih kamera"
              value={media.cameraId}
              options={media.devices.cameras}
              fallbackLabel="Kamera tidak terdeteksi"
              onChange={media.selectCamera}
            />
            {media.cameraError && (
              <p role="alert" className="text-[11px] leading-relaxed text-destructive">
                {media.cameraError}
              </p>
            )}
          </section>

          <section className="space-y-2.5 rounded-xl bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
                <Mic className="h-3 w-3" aria-hidden />
                Mikrofon
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (media.micOn ? media.stopMic() : void media.enableMic(media.micId ?? undefined))}
                disabled={media.micPending}
                className="h-7 gap-1.5 px-2 text-[11px]"
              >
                {media.micPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {media.micOn ? 'Matikan' : 'Nyalakan'}
              </Button>
            </div>

            <DeviceSelect
              id="mic-device"
              label="Pilih mikrofon"
              value={media.micId}
              options={media.devices.microphones}
              fallbackLabel="Mikrofon tidak terdeteksi"
              onChange={media.selectMic}
            />
            <MicLevelMeter stream={media.micStream} />
            {media.micError && (
              <p role="alert" className="text-[11px] leading-relaxed text-destructive">
                {media.micError}
              </p>
            )}
          </section>

          <section className="space-y-2.5 rounded-xl bg-secondary/40 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
              <Volume2 className="h-3 w-3" aria-hidden />
              Speaker
            </h3>
            {speakerSupported ? (
              <DeviceSelect
                id="speaker-device"
                label="Pilih output audio"
                value={media.speakerId}
                options={media.devices.speakers}
                fallbackLabel="Output default perangkat"
                onChange={media.setSpeakerId}
              />
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Browser ini tidak mendukung pemilihan speaker. Audio mengikuti output default perangkat.
              </p>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
