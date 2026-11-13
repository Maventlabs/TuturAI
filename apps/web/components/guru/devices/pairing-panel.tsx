'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { EmptyNote } from '@/components/guru/overview/panel'
import { cn } from '@/lib/utils'
import type { PairingTicket } from './types'

const PAIRING_TTL_MS = 15 * 60 * 1000

function countdown(remaining: number) {
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

interface PairingPanelProps {
  ticket: PairingTicket | null
  busy: boolean
  error: string | null
  onGenerate: (label: string) => void
  onDismiss: () => void
}

export function PairingPanel({ ticket, busy, error, onGenerate, onDismiss }: PairingPanelProps) {
  const [label, setLabel] = useState('')
  const [remaining, setRemaining] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!ticket) return
    const tick = () => setRemaining(Math.max(0, Date.parse(ticket.expiresAt) - Date.now()))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [ticket])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyCode() {
    if (!ticket) return
    try {
      await navigator.clipboard.writeText(ticket.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <EmptyNote
          title="Belum ada kode aktif"
          description="Kode pairing hanya berlaku 15 menit dan sekali pakai. Perangkat menukar kode ini dengan kredensialnya sendiri."
        />

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            onGenerate(label.trim())
            setLabel('')
          }}
        >
          <label htmlFor="device-label" className="block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Nama unit (opsional)
          </label>
          <input
            id="device-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            placeholder="Unit 01 — XI IPA 1"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-foreground px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Membuat kode' : 'Buat kode pairing'}
          </button>
        </form>

        {error && (
          <p role="alert" className="border-l-2 border-destructive/40 pl-2.5 text-[11px] leading-relaxed text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  const expired = remaining <= 0

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Kode pairing</p>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <p
            data-testid="pairing-code"
            className={cn(
              'font-mono text-[30px] font-medium leading-none tracking-[0.14em] tabular-nums',
              expired ? 'text-muted-foreground/40 line-through' : 'text-foreground',
            )}
          >
            {ticket.code}
          </p>
          <button
            type="button"
            onClick={() => void copyCode()}
            aria-label="Salin kode pairing"
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', expired ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${Math.max(0, Math.min(100, (remaining / PAIRING_TTL_MS) * 100))}%` }}
          />
        </div>
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {expired ? 'Kode kedaluwarsa — buat kode baru' : `Berlaku ${countdown(remaining)} lagi`}
        </p>
      </div>

      <ol className="space-y-1.5 border-t border-rule pt-3">
        {['Nyalakan perangkat TuturAI', 'Masukkan kode di layar pairing', 'Unit muncul di daftar armada'].map((step, index) => (
          <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-mono text-[9px] tabular-nums text-muted-foreground/50">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-2 border-t border-rule pt-3">
        <button
          type="button"
          onClick={() => onGenerate('')}
          disabled={busy}
          className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary hover:underline disabled:opacity-50"
        >
          {expired ? 'Kode baru' : 'Ganti kode'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:underline"
        >
          Tutup
        </button>
      </div>

      <details className="border-t border-rule pt-3">
        <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70 hover:text-foreground">
          Protokol perangkat
        </summary>
        <div className="mt-2 space-y-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <p className="text-foreground/80">POST /api/device/pair</p>
          <pre className="overflow-x-auto rounded-sm bg-muted/60 p-2 text-[10px] text-foreground/80">{`{ "code": "${ticket.code}",
  "hardwareId": "A0:B1:C2:D3:E4:F5",
  "firmware": "1.4.2" }`}</pre>
          <p className="text-foreground/80">POST /api/device/heartbeat</p>
          <pre className="overflow-x-auto rounded-sm bg-muted/60 p-2 text-[10px] text-foreground/80">{`x-device-id: ${ticket.deviceId}
x-device-secret: <secret dari /pair>
{ "battery": 82, "signal": 67 }`}</pre>
        </div>
      </details>
    </div>
  )
}
