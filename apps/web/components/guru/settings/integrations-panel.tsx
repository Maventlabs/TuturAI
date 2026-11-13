'use client'

import { SectionHeader, SheetButton, SheetNote, StatusChip, sheetButtonClass, type StatusTone } from './primitives'

export interface DriveStatus {
  connected: boolean
  scope: string | null
  updatedAt: string | null
}

export interface VoiceProfileStatus {
  status: string
  providerVoiceId?: string | null
  errorCode?: string | null
}

const VOICE_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  not_configured: { label: 'Belum terdaftar', tone: 'idle' },
  processing: { label: 'Diproses', tone: 'warn' },
  ready: { label: 'Aktif', tone: 'ok' },
  failed: { label: 'Gagal', tone: 'error' },
}

function formatStamp(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toISOString().slice(0, 10)
}

interface IntegrationsPanelProps {
  drive: DriveStatus | null
  driveBusy: boolean
  driveError: string | null
  onDisconnectDrive: () => void
  voice: VoiceProfileStatus | null
  voiceBusy: boolean
  voiceError: string | null
  voiceText: string
  voiceFile: File | null
  voiceConsent: boolean
  onVoiceTextChange: (value: string) => void
  onVoiceFileChange: (file: File | null) => void
  onVoiceConsentChange: (value: boolean) => void
  onEnroll: () => void
  onDelete: () => void
  onCheckStatus: () => void
  previewText: string
  previewUrl: string | null
  onPreviewTextChange: (value: string) => void
  onPreview: () => void
}

export function IntegrationsPanel({
  drive,
  driveBusy,
  driveError,
  onDisconnectDrive,
  voice,
  voiceBusy,
  voiceError,
  voiceText,
  voiceFile,
  voiceConsent,
  onVoiceTextChange,
  onVoiceFileChange,
  onVoiceConsentChange,
  onEnroll,
  onDelete,
  onCheckStatus,
  previewText,
  previewUrl,
  onPreviewTextChange,
  onPreview,
}: IntegrationsPanelProps) {
  const voiceStatus = voice?.status ?? 'not_configured'
  const voiceMeta = VOICE_LABELS[voiceStatus] ?? { label: voiceStatus, tone: 'idle' as StatusTone }
  const voiceReady = voiceStatus === 'ready'
  const voiceProcessing = voiceStatus === 'processing'
  const canEnroll = Boolean(voiceFile) && voiceText.trim().length >= 3 && voiceConsent
  const missing = [
    voiceText.trim().length < 3 ? 'kalimat referensi' : null,
    voiceFile ? null : 'file audio',
    voiceConsent ? null : 'persetujuan',
  ].filter(Boolean)

  return (
    <section id="integrasi" className="scroll-mt-24 px-5 py-5 sm:px-6">
      <SectionHeader
        label="Integrasi"
        description="Dua koneksi eksternal yang dipakai pipeline penilaian dan penyimpanan lampiran. Keduanya terpisah dari login TuturAI."
        status={
          <StatusChip tone={drive?.connected && voiceReady ? 'ok' : 'idle'}>
            {[drive?.connected, voiceReady].filter(Boolean).length} dari 2 aktif
          </StatusChip>
        }
      />

      <div className="mt-4 border-t border-rule pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-medium text-foreground">Google Drive</h3>
              <StatusChip tone={drive?.connected ? 'ok' : 'idle'}>
                {drive?.connected ? 'Terhubung' : 'Belum terhubung'}
              </StatusChip>
            </div>
            <p className="mt-1 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">
              Lampiran tugas dan submission disimpan di Drive guru dengan scope{' '}
              <span className="font-mono text-[11px] text-foreground">drive.file</span>. TuturAI hanya menyimpan
              metadata berkas.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href="/api/integrations/google-drive/start"
              className={sheetButtonClass(drive?.connected ? 'outline' : 'primary')}
            >
              {drive?.connected ? 'Hubungkan ulang' : 'Hubungkan Drive'}
            </a>
            {drive?.connected && (
              <SheetButton onClick={onDisconnectDrive} disabled={driveBusy}>
                {driveBusy ? 'Memutuskan' : 'Putuskan'}
              </SheetButton>
            )}
          </div>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[9px] uppercase tracking-[0.1em]">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground/60">Scope</dt>
            <dd className="text-foreground/70">{drive?.scope ?? '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground/60">Diperbarui</dt>
            <dd className="text-foreground/70">{formatStamp(drive?.updatedAt ?? null)}</dd>
          </div>
        </dl>

        {driveError && <SheetNote tone="error">{driveError}</SheetNote>}
      </div>

      <div className="mt-4 border-t border-rule pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-medium text-foreground">Voice profile OmniVoice</h3>
              <StatusChip tone={voiceMeta.tone}>{voiceMeta.label}</StatusChip>
            </div>
            <p className="mt-1 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">
              Sample audio hanya dikirim untuk enrollment voice profile guru ini dan tidak disimpan oleh TuturAI.
              Satu guru hanya memiliki satu voice profile aktif.
            </p>
          </div>
          {voiceStatus !== 'not_configured' && (
            <SheetButton onClick={onDelete} disabled={voiceBusy}>
              {voiceBusy ? 'Memproses' : 'Hapus profile'}
            </SheetButton>
          )}
        </div>

        {voiceProcessing && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border border-warning/30 bg-warning/5 px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
              Provider sedang memproses sample
            </p>
            <SheetButton onClick={onCheckStatus} disabled={voiceBusy} className="ml-auto">
              Periksa status
            </SheetButton>
          </div>
        )}

        {voiceReady ? (
          <div className="mt-4 border border-rule px-3.5 py-3">
            <label
              htmlFor="voice-preview"
              className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Teks preview
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input
                id="voice-preview"
                value={previewText}
                onChange={(event) => onPreviewTextChange(event.target.value)}
                maxLength={500}
                placeholder="Tulis teks untuk preview suara"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <SheetButton onClick={onPreview} disabled={voiceBusy || !previewText.trim()}>
                {voiceBusy ? 'Memuat' : 'Putar preview'}
              </SheetButton>
            </div>
            {previewUrl && <audio controls src={previewUrl} className="mt-2.5 h-9 w-full" />}
          </div>
        ) : (
          !voiceProcessing && (
            <div className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="voice-text"
                  className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Langkah 1 · Kalimat referensi
                </label>
                <input
                  id="voice-text"
                  value={voiceText}
                  onChange={(event) => onVoiceTextChange(event.target.value)}
                  placeholder="Tulis persis kalimat yang akan direkam"
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Langkah 2 · Sample audio
                </p>
                <label className="mt-1.5 flex cursor-pointer items-center justify-between gap-3 border border-dashed border-border px-3 py-2.5 transition-colors hover:border-foreground/40 focus-within:border-foreground">
                  <span className="truncate text-[12px] text-muted-foreground">
                    {voiceFile ? voiceFile.name : 'Belum ada file dipilih'}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground">
                    Pilih file
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={(event) => onVoiceFileChange(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <label className="flex items-start gap-2.5 border border-rule px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={voiceConsent}
                  onChange={(event) => onVoiceConsentChange(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                />
                <span className="text-[12px] leading-relaxed text-foreground">
                  Saya menyetujui sample suara ini diproses khusus untuk membuat voice profile TuturAI saya.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <SheetButton tone="primary" onClick={onEnroll} disabled={voiceBusy || !canEnroll}>
                  {voiceBusy ? 'Memproses' : 'Daftarkan voice'}
                </SheetButton>
                {!canEnroll && (
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                    Butuh {missing.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )
        )}

        {voiceError && <SheetNote tone="error">{voiceError}</SheetNote>}
      </div>
    </section>
  )
}
