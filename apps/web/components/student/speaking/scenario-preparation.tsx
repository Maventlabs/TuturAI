'use client'

import { ArrowLeft, Mic } from 'lucide-react'
import {
  SPEAKING_PRACTICE_MODES,
  SPEAKING_SESSION_TYPES,
  type SpeakingPracticeMode,
  type SpeakingScenarioBrief,
  type SpeakingSessionType,
} from '@tuturai/domain'
import { Button } from '@/components/ui/button'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'

function Paragraph({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[92px_1fr] sm:gap-4">
      <MonoLabel className="pt-1">{label}</MonoLabel>
      <p className="text-pretty font-display text-[15px] leading-[1.65] text-foreground/90">{children}</p>
    </div>
  )
}

export function ScenarioPreparation({
  scenario,
  mode,
  sessionType,
  onStart,
  onBack,
}: {
  scenario: SpeakingScenarioBrief
  mode: SpeakingPracticeMode
  sessionType: SpeakingSessionType
  onStart: () => void
  onBack: () => void
}) {
  const modeDefinition = SPEAKING_PRACTICE_MODES[mode]
  const sessionDefinition = SPEAKING_SESSION_TYPES[sessionType]
  const hasHints = scenario.talkingPoints.length > 0

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5 text-muted-foreground">
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All scenarios
      </Button>

      <Panel>
        <PanelHeader
          label="Scenario brief"
          right={
            <div className="flex items-center gap-3">
              <MonoLabel>{modeDefinition.label}</MonoLabel>
              <MonoLabel className="text-primary-deep">{sessionDefinition.label}</MonoLabel>
            </div>
          }
        />

        <div className="space-y-6 p-5 sm:p-6">
          <header className="border-b border-rule pb-5">
            <MonoLabel className="text-primary-deep">
              {scenario.category} · {scenario.difficulty}
            </MonoLabel>
            <h2 className="mt-2 text-balance font-display text-[26px] font-medium leading-[1.15] tracking-[-0.01em] text-foreground sm:text-[32px]">
              {scenario.title}
            </h2>
          </header>

          <div className="space-y-4">
            <Paragraph label="Situation">{scenario.situation}</Paragraph>
            <Paragraph label="Context">{scenario.context}</Paragraph>
            <Paragraph label="Your task">{scenario.objective}</Paragraph>
          </div>

          <div className="border-l-2 border-primary bg-primary/5 px-4 py-3.5">
            <MonoLabel className="text-primary-deep">Speak to this</MonoLabel>
            <p className="mt-1.5 text-pretty font-display text-[17px] leading-snug text-foreground sm:text-[19px]">
              {scenario.question}
            </p>
          </div>

          {hasHints ? (
            <div className="grid gap-px overflow-hidden rounded-sm border border-rule bg-rule md:grid-cols-3">
              <div className="bg-card p-4">
                <MonoLabel>Talking points</MonoLabel>
                <ol className="mt-2.5 space-y-2">
                  {scenario.talkingPoints.map((point, index) => (
                    <li key={point} className="flex gap-2 text-[12px] leading-relaxed text-foreground/85">
                      <span className="font-mono text-[10px] leading-[1.7] text-primary-deep">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {point}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="bg-card p-4">
                <MonoLabel>Useful expressions</MonoLabel>
                <ul className="mt-2.5 space-y-2">
                  {scenario.usefulExpressions.map((expression) => (
                    <li key={expression} className="text-[12px] leading-relaxed text-foreground/85">
                      <span className="text-muted-foreground">&ldquo;</span>
                      {expression}
                      <span className="text-muted-foreground">&rdquo;</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card p-4">
                <MonoLabel>Vocabulary</MonoLabel>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {scenario.vocabulary.map((word) => (
                    <li
                      key={word}
                      className="rounded-full border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/80"
                    >
                      {word}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-border px-4 py-3.5">
              <MonoLabel>Free practice</MonoLabel>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                No talking points, expressions, or vocabulary are provided in this mode. Plan your answer yourself,
                then speak for {sessionDefinition.minSeconds}–{sessionDefinition.maxSeconds} seconds.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <MonoLabel>Target {sessionDefinition.minSeconds}–{sessionDefinition.maxSeconds}s</MonoLabel>
            <MonoLabel>Speak in full sentences</MonoLabel>
          </div>
          <Button onClick={onStart} className="w-full gap-2 sm:w-auto">
            <Mic aria-hidden="true" className="size-4" />
            Start recording
          </Button>
        </div>
      </Panel>
    </div>
  )
}
