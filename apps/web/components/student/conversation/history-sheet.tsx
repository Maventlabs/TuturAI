'use client'

import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { ConversationHistoryItem } from './use-conversation'

const LEVEL_LABEL: Record<ConversationHistoryItem['level'], string> = {
  beginner: 'Dasar',
  intermediate: 'Menengah',
  advanced: 'Lanjut',
}

function formatWhen(timestamp: number) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

interface HistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ConversationHistoryItem[]
  loading: boolean
  onSelect: (sessionId: string) => void
}

export function HistorySheet({ open, onOpenChange, items, loading, onSelect }: HistorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-base font-bold">Riwayat percakapan</SheetTitle>
          <SheetDescription>Lanjutkan sesi yang belum selesai atau buka ringkasan belajarnya.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Memuat riwayat…
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada percakapan tersimpan.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="w-full rounded-xl bg-card px-3.5 py-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-primary/5 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.topicLabel ?? 'Percakapan bebas'}</p>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        {item.status === 'ended' ? 'Selesai' : 'Aktif'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatWhen(item.startedAt)} · {item.turnCount} giliran · {LEVEL_LABEL[item.level]}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
