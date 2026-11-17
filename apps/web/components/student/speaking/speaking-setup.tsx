'use client'

import { Check } from 'lucide-react'
import {
  SPEAKING_PRACTICE_MODES,
  SPEAKING_SESSION_TYPES,
  type SpeakingPracticeMode,
  type SpeakingSessionType,
} from '@tuturai/domain'
import { MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import { cn } from '@/lib/utils'

const MODE_ORDER: SpeakingPracticeMode[] = ['guided', 'free']
const SESSION_ORDER: SpeakingSessionType[] = ['quick', 'full']

function OptionCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  meta,
  points,
}: {
  name: string
  value: string
  checked: boolean
  onSelect: () => void
  title: string
  description: string
  meta: string
  points: readonly string[]
}) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer flex-col gap-2.5 rounded-sm border p-4 transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-rule bg-card hover:border-foreground/30',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-[14px] font-bold leading-tight text-foreground">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
          )}
        >
          {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
        </span>
      </div>
      <MonoLabel className="text-primary-deep">{meta}</MonoLabel>
      <ul className="mt-0.5 space-y-1">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <span aria-hidden="true" className="mt-[6px] size-1 shrink-0 rounded-full bg-border" />
            {point}
          </li>
        ))}
      </ul>
    </label>
  )
}

export function SpeakingSetup({
  mode,
  sessionType,
  onModeChange,
  onSessionTypeChange,
}: {
  mode: SpeakingPracticeMode
  sessionType: SpeakingSessionType
  onModeChange: (mode: SpeakingPracticeMode) => void
  onSessionTypeChange: (sessionType: SpeakingSessionType) => void
}) {
  return (
    <Panel>
      <PanelHeader label="Session setup" right={<MonoLabel>Step 01</MonoLabel>} />
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="mb-3">
            <MonoLabel>Practice mode</MonoLabel>
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODE_ORDER.map((id) => {
              const definition = SPEAKING_PRACTICE_MODES[id]
              return (
                <OptionCard
                  key={id}
                  name="speaking-mode"
                  value={id}
                  checked={mode === id}
                  onSelect={() => onModeChange(id)}
                  title={definition.label}
                  description={definition.description}
                  meta={definition.showsGuidedHints ? 'Hints shown' : 'No hints'}
                  points={definition.benefits}
                />
              )
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-3">
            <MonoLabel>Session type</MonoLabel>
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SESSION_ORDER.map((id) => {
              const definition = SPEAKING_SESSION_TYPES[id]
              return (
                <OptionCard
                  key={id}
                  name="speaking-session-type"
                  value={id}
                  checked={sessionType === id}
                  onSelect={() => onSessionTypeChange(id)}
                  title={definition.label}
                  description={definition.description}
                  meta={`${definition.minSeconds}–${definition.maxSeconds} seconds`}
                  points={[definition.instruction]}
                />
              )
            })}
          </div>
        </fieldset>
      </div>
    </Panel>
  )
}
