'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ChatMessage } from './types'

interface RoomChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: ChatMessage[]
  partnerNames: string[]
  onSend: (body: string) => void
  disabled?: boolean
}

export function RoomChat({ open, onOpenChange, messages, partnerNames, onSend, disabled }: RoomChatProps) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, open])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-b border-rule">
          <SheetTitle className="font-heading text-sm font-bold">Obrolan sesi</SheetTitle>
          <SheetDescription className="text-[11px]">
            {partnerNames.length > 0 ? `Dengan ${partnerNames.join(', ')}` : 'Belum ada peserta lain'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Belum ada pesan</p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Mulai dengan sapaan singkat, lalu lanjutkan misi sesi.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={cn('flex flex-col gap-0.5', message.author === 'me' ? 'items-end' : 'items-start')}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {message.author === 'me' ? 'Kamu' : message.authorName}
                  </span>
                  <span
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                      message.author === 'me'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground',
                    )}
                  >
                    {message.body}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div ref={endRef} aria-hidden />
        </div>

        <div className="border-t border-rule px-3 py-3">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="chat-input" className="sr-only">
              Tulis pesan
            </label>
            <textarea
              id="chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return
                if (event.nativeEvent.isComposing || event.keyCode === 229) return
                event.preventDefault()
                submit()
              }}
              rows={1}
              disabled={disabled}
              placeholder="Tulis pesan…"
              className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={disabled || draft.trim().length === 0}
              aria-label="Kirim pesan"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </form>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Mode pratinjau: pesan tidak dikirim ke server. Jangan bagikan kontak pribadi.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
