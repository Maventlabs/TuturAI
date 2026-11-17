'use client'

import { CONVERSATION_STARTERS } from '@tuturai/domain'

interface StarterGridProps {
  disabled: boolean
  onSelect: (topicId: string) => void
}

export function StarterGrid({ disabled, onSelect }: StarterGridProps) {
  return (
    <section aria-labelledby="conversation-starter-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="conversation-starter-heading"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Pilih topik
        </h2>
        <p className="text-[11px] text-muted-foreground">Opsional</p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CONVERSATION_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(starter.id)}
            className="rounded-xl bg-card px-3 py-2.5 text-left ring-1 ring-foreground/10 transition-colors hover:bg-primary/5 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="block text-sm font-medium text-foreground">{starter.label}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{starter.blurb}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
