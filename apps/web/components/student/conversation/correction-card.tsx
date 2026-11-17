import type { ConversationCorrection } from '@tuturai/domain'

const CATEGORY_LABEL: Record<ConversationCorrection['category'], string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  sentence_structure: 'Struktur',
  natural_expression: 'Natural',
}

/**
 * Teaching feedback gets its own surface so a correction never reads as part of
 * the tutor's spoken reply.
 */
export function CorrectionCard({ corrections }: { corrections: ConversationCorrection[] }) {
  if (corrections.length === 0) return null

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
          {corrections.length === 1 ? 'Satu koreksi' : `${corrections.length} koreksi`}
        </p>
      </div>

      <ul className="divide-y divide-rule">
        {corrections.map((correction, index) => (
          <li key={`${correction.original}-${index}`} className="px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Kalimatmu</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                {CATEGORY_LABEL[correction.category]}
              </p>
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{correction.original}</p>

            <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Lebih baik</p>
            <p className="mt-0.5 text-sm font-medium leading-relaxed text-foreground">{correction.corrected}</p>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty">{correction.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
