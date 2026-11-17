'use client'

import { Link2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DraftLink {
  id: string
  label: string
  url: string
}

export function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function createDraftLink(): DraftLink {
  return { id: crypto.randomUUID(), label: '', url: '' }
}

/** Only complete, valid rows are sent; a half-typed row is not an error. */
export function toLinkPayload(links: DraftLink[]) {
  return links
    .filter((link) => isHttpUrl(link.url))
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
}

export function LinkListEditor({
  links,
  onChange,
  withLabel = false,
  max = 8,
  addLabel = 'Tautan',
  urlPlaceholder = 'https://',
}: {
  links: DraftLink[]
  onChange: (next: DraftLink[]) => void
  withLabel?: boolean
  max?: number
  addLabel?: string
  urlPlaceholder?: string
}) {
  function update(id: string, patch: Partial<DraftLink>) {
    onChange(links.map((link) => (link.id === id ? { ...link, ...patch } : link)))
  }

  return (
    <div className="space-y-2">
      {links.map((link, index) => {
        const invalid = link.url.trim().length > 0 && !isHttpUrl(link.url)
        return (
          <div key={link.id} className="flex items-start gap-1.5">
            <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center text-muted-foreground">
              <Link2 className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row">
              {withLabel && (
                <label className="min-w-0 sm:w-36 sm:shrink-0">
                  <span className="sr-only">Label tautan {index + 1}</span>
                  <input
                    value={link.label}
                    onChange={(event) => update(link.id, { label: event.target.value })}
                    maxLength={80}
                    placeholder="Label (opsional)"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                  />
                </label>
              )}
              <label className="min-w-0 flex-1">
                <span className="sr-only">URL tautan {index + 1}</span>
                <input
                  value={link.url}
                  onChange={(event) => update(link.id, { url: event.target.value })}
                  inputMode="url"
                  autoComplete="off"
                  aria-invalid={invalid}
                  placeholder={urlPlaceholder}
                  className={cn(
                    'h-9 w-full rounded-lg border bg-background px-2.5 font-mono text-[12px] text-foreground outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground/70 focus-visible:ring-2',
                    invalid
                      ? 'border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/15'
                      : 'border-border focus-visible:border-primary focus-visible:ring-primary/15',
                  )}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => onChange(links.filter((entry) => entry.id !== link.id))}
              aria-label={`Hapus tautan ${index + 1}`}
              className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )
      })}

      {links.length < max && (
        <button
          type="button"
          onClick={() => onChange([...links, createDraftLink()])}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="size-3" aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  )
}
