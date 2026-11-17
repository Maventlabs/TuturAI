'use client'

import { AlertTriangle, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { SPEAKING_PRACTICE_MODES, SPEAKING_SESSION_TYPES } from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import {
  DimensionBar,
  MonoLabel,
  Panel,
  PanelHeader,
  Readout,
} from '@/components/student/practice/practice-ui'
import type { SpeakingAttempt, SpeakingDimension } from '@/lib/speaking/assessment-pipeline'
import { cn } from '@/lib/utils'

const DIMENSIONS: Array<{ id: SpeakingDimension; label: string }> = [
  { id: 'pronunciation', label: 'Pronunciation' },
  { id: 'fluency', label: 'Fluency' },
  { id: 'intonation', label: 'Intonation' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocabulary' },
]

const INSUFFICIENT_NOTE: Record<SpeakingDimension, string> = {
  pronunciation: 'Pronunciation needs phoneme-level alignment. It is never estimated from the transcript.',
  fluency: 'Speech timing could not be measured from this recording.',
  intonation: 'Not enough voiced pitch was detected to measure intonation.',
  grammar: 'Too few words were spoken to judge grammar reliably.',
  vocabulary: 'Too few words were spoken to measure vocabulary range.',
}

function verdict(score: number) {
  if (score >= 85) return { label: 'Excellent', note: 'Confident, well-organised, and easy to follow.' }
  if (score >= 70) return { label: 'Strong', note: 'Clear and effective, with a few details to tighten.' }
  if (score >= 55) return { label: 'Developing', note: 'The message lands, but structure and accuracy can improve.' }
  if (score >= 40) return { label: 'Building', note: 'Keep practising — focus on complete sentences and pace.' }
  return { label: 'Starting out', note: 'Speak a little longer and in fuller sentences next time.' }
}

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function RetryPanel({
  attempt,
  onRetry,
  onBack,
}: {
  attempt: SpeakingAttempt
  onRetry: () => void
  onBack: () => void
}) {
  const failed = attempt.status === 'FAILED'
  return (
    <Panel>
      <PanelHeader
        label={failed ? 'Assessment failed' : 'Recording needs another take'}
        right={<MonoLabel>{attempt.scenarioTitle}</MonoLabel>}
      />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-destructive/40 text-destructive">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
          </span>
          <div>
            <p className="font-heading text-[15px] font-bold text-foreground">
              {failed ? 'We could not finish the assessment' : 'This recording cannot be scored'}
            </p>
            <p className="mt-1 max-w-[56ch] text-[12px] leading-relaxed text-muted-foreground">
              {attempt.failure?.message ?? 'Record again to get a score.'}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-rule pt-4 sm:grid-cols-4">
          <Readout label="Duration" value={formatDuration(attempt.durationMs)} />
          <Readout label="Speech" value={(attempt.qualityGate.speechDurationMs / 1000).toFixed(1)} unit="s" />
          <Readout label="Voiced" value={(attempt.acoustic.voicedDurationMs / 1000).toFixed(1)} unit="s" />
          <Readout label="Code" value={attempt.failure?.code ?? '—'} />
        </dl>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No score was recorded for this attempt, so it does not affect your progress.
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-rule px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Choose another scenario
        </Button>
        <Button size="sm" onClick={onRetry} className="gap-1.5">
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Record again
        </Button>
      </div>
    </Panel>
  )
}

export function EvaluationDashboard({
  attempt,
  onRetry,
  onNext,
  onBack,
}: {
  attempt: SpeakingAttempt
  onRetry: () => void
  onNext: () => void
  onBack: () => void
}) {
  if (attempt.status === 'RETRY_REQUIRED' || attempt.status === 'FAILED') {
    return <RetryPanel attempt={attempt} onRetry={onRetry} onBack={onBack} />
  }

  const { scores, analysis, acoustic, metricStatuses } = attempt
  const band = scores.final === null ? null : verdict(scores.final)
  // A provider can echo a phrase back unchanged; showing it as a correction
  // would tell the learner to fix something that is already right.
  const corrections = (analysis?.corrections ?? []).filter(
    (correction) => correction.original.trim().toLowerCase() !== correction.corrected.trim().toLowerCase(),
  )
  const grammarFindings = (analysis?.grammarFindings ?? []).filter(
    (finding) =>
      !finding.original
      || !finding.corrected
      || finding.original.trim().toLowerCase() !== finding.corrected.trim().toLowerCase(),
  )
  const coachNotes = analysis
    ? [
        ...DIMENSIONS.map((dimension) => ({
          label: dimension.label,
          text: analysis.dimensionFeedback[dimension.id],
        })).filter((note) => Boolean(note.text)),
        ...(analysis.relevance.comment ? [{ label: 'Task relevance', text: analysis.relevance.comment }] : []),
        ...(analysis.coherence.comment ? [{ label: 'Coherence', text: analysis.coherence.comment }] : []),
      ]
    : []

  const grammarCounts = grammarFindings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
    return counts
  }, {})

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          label="Result"
          right={
            <div className="flex items-center gap-3">
              <MonoLabel>{SPEAKING_PRACTICE_MODES[attempt.practiceMode].label}</MonoLabel>
              <MonoLabel className="text-primary-deep">{SPEAKING_SESSION_TYPES[attempt.sessionType].label}</MonoLabel>
            </div>
          }
        />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <MonoLabel className="text-primary-deep">{attempt.scenarioTitle}</MonoLabel>
            <div className="mt-2 flex items-end gap-3">
              <span
                className={cn(
                  'font-mono text-[56px] font-medium leading-none tabular-nums tracking-[-0.03em]',
                  scores.final === null ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {scores.final === null ? '—' : Math.round(scores.final)}
              </span>
              <span className="pb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {scores.final === null ? 'score withheld' : '/ 100 overall'}
              </span>
            </div>
            <p className="mt-2 font-heading text-[15px] font-bold text-foreground">
              {band ? band.label : 'Not every dimension could be measured'}
            </p>
            <p className="mt-1 max-w-[46ch] text-[12px] leading-relaxed text-muted-foreground">
              {band
                ? band.note
                : 'The overall score is only shown when all five dimensions have real evidence. The dimensions below show what was measured.'}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-4 sm:grid-cols-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <Readout label="Duration" value={formatDuration(attempt.durationMs)} />
            <Readout label="Words" value={attempt.wordCount} />
            <Readout label="Pace" value={acoustic.wpm === null ? '—' : Math.round(acoustic.wpm)} unit="wpm" />
            <Readout label="Pauses" value={Math.round(acoustic.pauseRatio * 100)} unit="%" />
          </dl>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader label="Five dimensions" right={<MonoLabel>Canonical engine</MonoLabel>} />
          <div className="space-y-4 p-4 sm:p-5">
            {DIMENSIONS.map((dimension) => {
              const value = scores[dimension.id]
              const scored = value !== null && metricStatuses[dimension.id] === 'complete'
              return (
                <DimensionBar
                  key={dimension.id}
                  label={dimension.label}
                  labelWidth="wide"
                  value={value}
                  status={scored ? 'scored' : 'insufficient'}
                  note={scored ? undefined : INSUFFICIENT_NOTE[dimension.id]}
                />
              )
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHeader label="Measured evidence" right={<MonoLabel>From the audio</MonoLabel>} />
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 sm:p-5">
            <Readout label="Signal / noise" value={acoustic.snrDb.toFixed(1)} unit="dB" />
            <Readout label="Speech time" value={(acoustic.speechDurationMs / 1000).toFixed(1)} unit="s" />
            <Readout label="Pause time" value={(acoustic.totalPauseDurationMs / 1000).toFixed(1)} unit="s" />
            <Readout label="Voiced pitch" value={(acoustic.voicedDurationMs / 1000).toFixed(1)} unit="s" />
            <Readout label="Mean pitch" value={acoustic.meanF0Hz === null ? '—' : Math.round(acoustic.meanF0Hz)} unit="Hz" />
            <Readout
              label="Pitch range"
              value={acoustic.pitchVariationSemitones === null ? '—' : acoustic.pitchVariationSemitones.toFixed(1)}
              unit="st"
            />
          </dl>
          <p className="border-t border-rule px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
            These values come from the decoded recording, not from the transcript. Pronunciation is only scored when a
            phoneme alignment provider is configured.
          </p>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          label="Transcript review"
          right={<MonoLabel>{attempt.wordCount} words</MonoLabel>}
        />
        <div className="space-y-5 p-4 sm:p-5">
          <p className="text-pretty font-display text-[15px] leading-[1.7] text-foreground/90">
            {attempt.transcript}
          </p>

          {corrections.length > 0 ? (
            <div className="border-t border-rule pt-4">
              <MonoLabel>Corrections</MonoLabel>
              <ul className="mt-2.5 space-y-2.5">
                {corrections.slice(0, 6).map((correction, index) => (
                  <li key={`${correction.original}-${index}`} className="text-[12px] leading-relaxed">
                    <span className="text-muted-foreground line-through decoration-destructive/50">
                      {correction.original}
                    </span>
                    <span aria-hidden="true" className="mx-1.5 text-muted-foreground">
                      →
                    </span>
                    <span className="font-medium text-foreground">{correction.corrected}</span>
                    {correction.explanation ? (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{correction.explanation}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {grammarFindings.length > 0 ? (
            <div className="border-t border-rule pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MonoLabel>Grammar findings</MonoLabel>
                <div className="flex gap-3">
                  {(['heavy', 'medium', 'light'] as const).map((severity) => (
                    <MonoLabel key={severity}>
                      {severity} {grammarCounts[severity] ?? 0}
                    </MonoLabel>
                  ))}
                </div>
              </div>
              <ul className="mt-2.5 space-y-2">
                {grammarFindings.slice(0, 6).map((finding, index) => (
                  <li key={`${finding.category}-${index}`} className="flex gap-2 text-[12px] leading-relaxed">
                    <span
                      className={cn(
                        'mt-[3px] shrink-0 rounded-[2px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]',
                        finding.severity === 'heavy' && 'bg-destructive/10 text-destructive',
                        finding.severity === 'medium' && 'bg-primary/10 text-primary-deep',
                        finding.severity === 'light' && 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {finding.severity}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{finding.category}</span>
                      {finding.original ? (
                        <span className="text-muted-foreground"> · {finding.original}</span>
                      ) : null}
                      {finding.corrected ? (
                        <span className="text-foreground"> → {finding.corrected}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Panel>

      {analysis ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader label="What worked" />
            <ul className="space-y-2 p-4 sm:p-5">
              {(analysis.strengths.length > 0 ? analysis.strengths : ['You completed the task and stayed on topic.']).map(
                (item) => (
                  <li key={item} className="flex gap-2 text-[12px] leading-relaxed text-foreground/85">
                    <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader label="What to improve" />
            <ul className="space-y-2 p-4 sm:p-5">
              {(analysis.improvements.length > 0 ? analysis.improvements : ['Speak a little longer next time.']).map(
                (item) => (
                  <li key={item} className="flex gap-2 text-[12px] leading-relaxed text-foreground/85">
                    <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-foreground/40" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </Panel>
        </div>
      ) : null}

      {analysis ? (
        <Panel>
          <PanelHeader label="Coach notes" right={<MonoLabel>Per dimension</MonoLabel>} />
          <dl className="grid gap-px bg-rule sm:grid-cols-2">
            {coachNotes.map((note) => (
              <div key={note.label} className="bg-card p-4">
                <MonoLabel>{note.label}</MonoLabel>
                <dd className="mt-1.5 text-[12px] leading-relaxed text-foreground/85">{note.text}</dd>
              </div>
            ))}
            {coachNotes.length % 2 === 1 ? <div aria-hidden="true" className="hidden bg-card sm:block" /> : null}
          </dl>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All scenarios
        </Button>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Try this scenario again
        </Button>
        <Button size="sm" onClick={onNext} className="gap-1.5">
          Next scenario
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
