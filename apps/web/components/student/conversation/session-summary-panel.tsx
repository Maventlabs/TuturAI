'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import type { ConversationSummary } from '@tuturai/domain'
import { Button } from '@/components/ui/button'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2.5 py-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

interface SessionSummaryPanelProps {
  summary: ConversationSummary
  onNewSession: () => void
}

export function SessionSummaryPanel({ summary, onNewSession }: SessionSummaryPanelProps) {
  const { overview, grammar, vocabulary, naturalExpressions, recommendations } = summary

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">Ringkasan belajar</p>
        <h2 className="mt-1 font-display text-2xl leading-snug text-foreground text-balance">
          Yang kamu latih di percakapan ini
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{overview.summary}</p>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Durasi" value={`${overview.durationMinutes} mnt`} />
          <Stat label="Giliran" value={String(overview.turns)} />
          <Stat label="Topik" value={overview.topics[0] ?? 'Bebas'} />
        </dl>
      </div>

      {!summary.sufficientEvidence && (
        <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Data percakapan ini belum cukup untuk ringkasan yang representatif. Ringkasan akan lebih berguna setelah beberapa giliran lagi.</span>
        </p>
      )}

      {grammar.length > 0 && (
        <Section title="Perbaikan tata bahasa">
          <ul className="space-y-3">
            {grammar.map((item, index) => (
              <li key={`${item.original}-${index}`} className="rounded-lg bg-card px-3 py-2.5 ring-1 ring-foreground/10">
                <p className="text-xs text-muted-foreground">{item.original}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{item.corrected}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.explanation}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {vocabulary.length > 0 && (
        <Section title="Kosakata baru">
          <dl className="divide-y divide-rule">
            {vocabulary.map((item) => (
              <div key={item.phrase} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-sm font-medium text-foreground">{item.phrase}</dt>
                <dd className="text-right text-xs text-muted-foreground">{item.meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {naturalExpressions.length > 0 && (
        <Section title="Ekspresi lebih natural">
          <ul className="space-y-2">
            {naturalExpressions.map((item, index) => (
              <li key={`${item.original}-${index}`} className="text-sm">
                <span className="text-muted-foreground">{item.original}</span>
                <span className="mx-1.5 text-muted-foreground/60" aria-hidden="true">
                  →
                </span>
                <span className="font-medium text-foreground">{item.natural}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {recommendations.length > 0 && (
        <Section title="Saran latihan berikutnya">
          <ol className="space-y-1.5">
            {recommendations.map((item, index) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-foreground">
                <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Button onClick={onNewSession} className="h-10 w-full gap-2">
        Mulai percakapan baru
      </Button>
    </div>
  )
}
