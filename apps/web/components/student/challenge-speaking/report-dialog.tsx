'use client'

import { useState } from 'react'
import { Check, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'Membagikan kontak pribadi',
  'Kata kasar atau pelecehan',
  'Konten tidak pantas',
  'Spam atau tidak relevan',
  'Lainnya',
]

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partnerName: string
}

export function ReportDialog({ open, onOpenChange, partnerName }: ReportDialogProps) {
  const [category, setCategory] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCategory(null)
      setNote('')
      setSubmitted(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />
            Laporkan peserta
          </DialogTitle>
          <DialogDescription>
            {partnerName ? `Laporkan perilaku ${partnerName} selama sesi.` : 'Laporkan perilaku peserta selama sesi.'}{' '}
            Laporan diverifikasi server sebelum tindakan diambil.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex-1 px-5 pb-1">
            <div className="rounded-xl bg-warning/10 p-3 ring-1 ring-warning/30">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
                <Check className="h-3 w-3" aria-hidden />
                Mode pratinjau
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-foreground">
                Laporan tidak dikirim ke server karena integrasi pelaporan belum aktif. Pada tahap berikutnya laporan
                akan disimpan dan ditinjau sebelum tindakan apa pun.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-1">
            <fieldset>
              <legend className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Kategori
              </legend>
              <div className="mt-2 space-y-1.5">
                {CATEGORIES.map((item) => {
                  const selected = category === item
                  return (
                    <label
                      key={item}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] ring-1 transition-colors',
                        selected
                          ? 'bg-destructive/[0.06] text-foreground ring-destructive/40'
                          : 'text-foreground ring-rule hover:bg-secondary/50',
                      )}
                    >
                      <input
                        type="radio"
                        name="report-category"
                        value={item}
                        checked={selected}
                        onChange={() => setCategory(item)}
                        className="h-3.5 w-3.5 accent-destructive"
                      />
                      {item}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="report-note"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                Catatan (opsional)
              </label>
              <textarea
                id="report-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Jelaskan singkat apa yang terjadi…"
                className="mt-1.5 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button onClick={() => onOpenChange(false)}>Tutup</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button variant="destructive" disabled={!category} onClick={() => setSubmitted(true)}>
                Kirim laporan
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
