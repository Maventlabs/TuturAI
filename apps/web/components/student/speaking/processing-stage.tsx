'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import { cn } from '@/lib/utils'

const STAGES = [
  { id: 'quality_check', label: 'Checking audio quality' },
  { id: 'transcribing', label: 'Transcribing your speech' },
  { id: 'acoustic_analysis', label: 'Measuring fluency and intonation' },
  { id: 'llm_analysis', label: 'Reviewing grammar and vocabulary' },
  { id: 'scoring', label: 'Calculating your score' },
] as const

const STAGE_INTERVAL_MS = 2400

export function ProcessingStage({ scenarioTitle }: { scenarioTitle: string }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => Math.min(STAGES.length - 1, current + 1))
    }, STAGE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <Panel>
      <PanelHeader label="Analysing" right={<MonoLabel>{scenarioTitle}</MonoLabel>} />
      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <h2 className="font-heading text-[18px] font-bold leading-tight text-foreground">
            Your answer is being assessed
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[12px] leading-relaxed text-muted-foreground">
            The recording is transcribed, measured, and scored on the server. This usually takes 10–20 seconds — keep
            this tab open.
          </p>
        </div>

        <ol className="space-y-0" aria-live="polite">
          {STAGES.map((stage, index) => {
            const done = index < activeIndex
            const active = index === activeIndex
            return (
              <li
                key={stage.id}
                className={cn(
                  'flex items-center gap-3 border-t border-rule py-3 first:border-t-0',
                  !done && !active && 'opacity-45',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    done && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-primary text-primary',
                    !done && !active && 'border-border text-muted-foreground',
                  )}
                >
                  {done ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <span className="size-1 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px] uppercase tracking-[0.12em]',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {stage.label}
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {done ? 'Done' : active ? 'Running' : 'Queued'}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </Panel>
  )
}
