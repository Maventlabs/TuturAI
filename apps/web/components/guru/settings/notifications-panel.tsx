'use client'

import { Switch } from '@/components/ui/switch'
import { SectionHeader, SettingRow, SheetButton, SheetNote, StatusChip } from './primitives'

export interface NotificationPrefs {
  submissions: boolean
  lowScore: boolean
  weekly: boolean
  device: boolean
}

const ROWS: { key: keyof NotificationPrefs; title: string; description: string }[] = [
  {
    key: 'submissions',
    title: 'Submission baru',
    description: 'Beri tahu saat siswa mengirim rekaman speaking untuk dinilai.',
  },
  {
    key: 'lowScore',
    title: 'Skor rendah',
    description: 'Peringatan saat skor siswa turun di bawah ambang batas kelas.',
  },
  {
    key: 'weekly',
    title: 'Rangkuman mingguan',
    description: 'Ringkasan performa kelas setiap Senin pagi.',
  },
  {
    key: 'device',
    title: 'Status perangkat',
    description: 'Pemberitahuan saat perangkat offline atau baterai di bawah 20%.',
  },
]

interface NotificationsPanelProps {
  value: NotificationPrefs
  saved: NotificationPrefs | null
  busy: boolean
  message: { tone: 'ok' | 'error'; text: string } | null
  onChange: (next: NotificationPrefs) => void
  onSave: () => void
  onReset: () => void
}

export function NotificationsPanel({ value, saved, busy, message, onChange, onSave, onReset }: NotificationsPanelProps) {
  const dirty = saved !== null && ROWS.some((row) => value[row.key] !== saved[row.key])
  const activeCount = ROWS.filter((row) => value[row.key]).length

  return (
    <section id="notifikasi" className="scroll-mt-24 px-5 py-5 sm:px-6">
      <SectionHeader
        label="Notifikasi"
        description="Pilih kejadian yang layak mengganggu Anda. Preferensi disimpan ke server, bukan ke perangkat ini."
        status={
          <StatusChip tone={activeCount > 0 ? 'ok' : 'idle'}>
            {activeCount} dari {ROWS.length} aktif
          </StatusChip>
        }
      />

      <div className="mt-4">
        {ROWS.map((row) => (
          <SettingRow key={row.key} title={row.title} description={row.description}>
            <Switch
              checked={value[row.key]}
              onCheckedChange={(checked) => onChange({ ...value, [row.key]: checked })}
              aria-label={row.title}
            />
          </SettingRow>
        ))}
      </div>

      {dirty ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-primary/25 bg-primary/5 px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">Perubahan belum disimpan</p>
          <div className="flex gap-2">
            <SheetButton onClick={onReset} disabled={busy}>
              Batalkan
            </SheetButton>
            <SheetButton tone="primary" onClick={onSave} disabled={busy}>
              {busy ? 'Menyimpan' : 'Simpan'}
            </SheetButton>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {saved === null ? 'Memuat preferensi' : 'Tersimpan di server'}
          </p>
          <SheetButton onClick={onSave} disabled={busy || saved === null}>
            {busy ? 'Menyimpan' : 'Simpan ulang'}
          </SheetButton>
        </div>
      )}

      {message && <SheetNote tone={message.tone === 'error' ? 'error' : 'muted'}>{message.text}</SheetNote>}
    </section>
  )
}
