'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SPEAKING_PRACTICE_MODES,
  SPEAKING_SESSION_TYPES,
  type SpeakingPracticeMode,
  type SpeakingScenarioBrief,
  type SpeakingSessionType,
} from '@tuturai/domain'
import { EmptyState, MonoLabel, PracticeHeader } from '@/components/student/practice/practice-ui'
import { usePcmRecorder } from '@/lib/audio/use-pcm-recorder'
import type { SpeakingAttempt } from '@/lib/speaking/assessment-pipeline'
import type { SpeakingHistoryEntry, SpeakingProgressSummary } from '@/lib/speaking/attempts'
import { EvaluationDashboard } from './evaluation-dashboard'
import { ProcessingStage } from './processing-stage'
import { RecordingStage } from './recording-stage'
import { ScenarioExplorer } from './scenario-explorer'
import { ScenarioPreparation } from './scenario-preparation'
import { SpeakingHistory } from './speaking-history'
import { SpeakingSetup } from './speaking-setup'

type Step = 'setup' | 'prepare' | 'record' | 'processing' | 'result'

const FLOW = [
  { step: '01', label: 'Choose a scenario' },
  { step: '02', label: 'Read the brief' },
  { step: '03', label: 'Speak and get scored' },
]

function newSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function SpeakingPractice() {
  const [mode, setMode] = useState<SpeakingPracticeMode>('guided')
  const [sessionType, setSessionType] = useState<SpeakingSessionType>('quick')
  const [scenarios, setScenarios] = useState<SpeakingScenarioBrief[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(true)
  const [scenariosError, setScenariosError] = useState<string | null>(null)

  const [step, setStep] = useState<Step>('setup')
  const [selected, setSelected] = useState<SpeakingScenarioBrief | null>(null)
  const [attempt, setAttempt] = useState<SpeakingAttempt | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [history, setHistory] = useState<SpeakingHistoryEntry[]>([])
  const [progress, setProgress] = useState<SpeakingProgressSummary | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)

  const recorder = usePcmRecorder()

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/student/speaking/assessments', { cache: 'no-store' })
      if (!response.ok) throw new Error('LOAD_FAILED')
      const payload = (await response.json()) as {
        data?: { attempts?: SpeakingHistoryEntry[]; progress?: SpeakingProgressSummary }
      }
      setHistory(payload.data?.attempts ?? [])
      setProgress(payload.data?.progress ?? null)
    } catch {
      setHistory([])
      setProgress(null)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    let cancelled = false
    setScenariosLoading(true)
    setScenariosError(null)
    fetch(`/api/student/speaking/scenarios?mode=${mode}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return (await response.json()) as { data?: { scenarios?: SpeakingScenarioBrief[] } }
      })
      .then((payload) => {
        if (cancelled) return
        setScenarios(payload.data?.scenarios ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setScenariosError('The scenario catalog could not be loaded. Check your connection and try again.')
      })
      .finally(() => {
        if (!cancelled) setScenariosLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  const openScenario = useCallback(
    (scenario: SpeakingScenarioBrief) => {
      recorder.reset()
      setSelected(scenario)
      setAttempt(null)
      setSubmitError(null)
      setStep('prepare')
    },
    [recorder],
  )

  const backToSetup = useCallback(() => {
    recorder.reset()
    setSelected(null)
    setAttempt(null)
    setSubmitError(null)
    setStep('setup')
  }, [recorder])

  const retryScenario = useCallback(() => {
    recorder.reset()
    setAttempt(null)
    setSubmitError(null)
    setStep('record')
  }, [recorder])

  const nextScenario = useCallback(() => {
    if (!selected || scenarios.length === 0) {
      backToSetup()
      return
    }
    const index = scenarios.findIndex((scenario) => scenario.id === selected.id)
    const next = scenarios[(index + 1) % scenarios.length]
    openScenario(next)
  }, [backToSetup, openScenario, scenarios, selected])

  const submit = useCallback(async () => {
    if (!selected || !recorder.wavBlob) return
    setSubmitting(true)
    setSubmitError(null)
    setStep('processing')

    const sessionId = newSessionId()
    const form = new FormData()
    form.set('sessionId', sessionId)
    form.set('scenarioId', selected.id)
    form.set('practiceMode', mode)
    form.set('sessionType', sessionType)
    form.set('audio', new File([recorder.wavBlob], `${sessionId}.wav`, { type: 'audio/wav' }))

    try {
      const response = await fetch('/api/student/speaking/assessments', { method: 'POST', body: form })
      const payload = (await response.json().catch(() => null)) as
        | { data?: SpeakingAttempt; error?: { message?: string } }
        | null

      if (payload?.data) {
        setAttempt(payload.data)
        setStep('result')
        void loadHistory()
      } else {
        setSubmitError(payload?.error?.message ?? 'The assessment could not be completed. Please try again.')
        setStep('record')
      }
    } catch {
      setSubmitError('The connection dropped while your answer was being assessed. Please try again.')
      setStep('record')
    } finally {
      setSubmitting(false)
    }
  }, [loadHistory, mode, recorder.wavBlob, selected, sessionType])

  const openHistoryEntry = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/student/speaking/assessments/${sessionId}`, { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as { data?: SpeakingAttempt }
      if (!payload.data) return
      setAttempt(payload.data)
      setSelected(null)
      setStep('result')
    } catch {
      // Opening a past session is a convenience; a failure leaves the list intact.
    }
  }, [])

  const meta = useMemo(
    () => [
      { label: 'Scenarios', value: scenarios.length || '—' },
      { label: 'Mode', value: SPEAKING_PRACTICE_MODES[mode].label.replace(' Practice', '') },
      { label: 'Session', value: `${SPEAKING_SESSION_TYPES[sessionType].minSeconds}–${SPEAKING_SESSION_TYPES[sessionType].maxSeconds}s` },
    ],
    [mode, scenarios.length, sessionType],
  )

  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Speaking"
        title="Speaking Practice"
        description="One scenario, one answer. Read the brief, speak for the target time, and get five dimensions scored from your recording and transcript."
        meta={meta}
      />

      {step === 'setup' ? (
        <>
          <ol className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule pb-4">
            {FLOW.map((item) => (
              <li key={item.step} className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-primary-deep">{item.step}</span>
                <MonoLabel>{item.label}</MonoLabel>
              </li>
            ))}
          </ol>

          <SpeakingSetup
            mode={mode}
            sessionType={sessionType}
            onModeChange={setMode}
            onSessionTypeChange={setSessionType}
          />

          {scenariosError ? (
            <EmptyState title="Catalog unavailable" description={scenariosError} />
          ) : (
            <ScenarioExplorer
              scenarios={scenarios}
              mode={mode}
              loading={scenariosLoading}
              onSelect={openScenario}
            />
          )}

          <SpeakingHistory
            attempts={history}
            progress={progress}
            loading={historyLoading}
            onOpen={(sessionId) => void openHistoryEntry(sessionId)}
          />
        </>
      ) : null}

      {step === 'prepare' && selected ? (
        <ScenarioPreparation
          scenario={selected}
          mode={mode}
          sessionType={sessionType}
          onStart={() => setStep('record')}
          onBack={backToSetup}
        />
      ) : null}

      {step === 'record' && selected ? (
        <RecordingStage
          scenario={selected}
          sessionType={sessionType}
          recorder={recorder}
          submitting={submitting}
          error={submitError}
          onAnalyse={() => void submit()}
          onBack={() => setStep('prepare')}
        />
      ) : null}

      {step === 'processing' ? <ProcessingStage scenarioTitle={selected?.title ?? 'Speaking answer'} /> : null}

      {step === 'result' && attempt ? (
        <EvaluationDashboard
          attempt={attempt}
          onRetry={retryScenario}
          onNext={nextScenario}
          onBack={backToSetup}
        />
      ) : null}
    </div>
  )
}
