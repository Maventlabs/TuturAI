'use client'

import { ChevronRight } from 'lucide-react'
import { MonoLabel, Panel, PanelHeader, Readout } from '@/components/student/practice/practice-ui'
import type { SpeakingHistoryEntry, SpeakingProgressSummary } from '@/lib/speaking/attempts'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Scored',
  INCOMPLETE: 'Partial',
  RETRY_REQUIRED: 'Retry',
  FAILED: 'Failed',
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function SpeakingHistory({
  attempts,
  progress,
  loading,
  onOpen,
}: {
  attempts: SpeakingHistoryEntry[]
  progress: SpeakingProgressSummary | null
  loading: boolean
  onOpen: (sessionId: string) => void
}) {
  return (
    <Panel>
      <PanelHeader
        label="Recent sessions"
        right={<MonoLabel>{loading ? 'Loading' : `${progress?.completedSessions ?? 0} scored`}</MonoLabel>}
      />

      {progress && progress.totalSessions > 0 ? (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-rule p-4 sm:grid-cols-4">
          <Readout label="Sessions" value={progress.totalSessions} />
          <Readout label="Average" value={progress.averageFinal === null ? '—' : Math.round(progress.averageFinal)} />
          <Readout label="Best" value={progress.bestFinal === null ? '—' : Math.round(progress.bestFinal)} />
          <Readout label="Last" value={progress.lastFinal === null ? '—' : Math.round(progress.lastFinal)} />
        </dl>
      ) : null}

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-sm bg-secondary" />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="font-heading text-[13px] font-bold text-foreground">No sessions yet</p>
          <p className="mx-auto mt-1 max-w-[40ch] text-[12px] leading-relaxed text-muted-foreground">
            Your first scored answer will appear here with its five dimensions.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {attempts.slice(0, 6).map((attempt) => (
            <li key={attempt.sessionId}>
              <button
                type="button"
                onClick={() => onOpen(attempt.sessionId)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {formatDate(attempt.createdAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-foreground">{attempt.scenarioTitle}</span>
                  <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {attempt.practiceMode} · {attempt.sessionType} · {Math.round(attempt.durationMs / 1000)}s
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[11px] tabular-nums',
                    attempt.final === null ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {attempt.final === null ? STATUS_LABEL[attempt.status] ?? '—' : Math.round(attempt.final)}
                </span>
                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
