'use client'

import { useMemo } from 'react'
import { VoiceOrb, type OrbState } from '@/components/student/ai-tutor/voice-orb'
import { ActivityHeatmap, type ActivityDay } from '@/components/student/activity-heatmap'
import LatihanBicaraAIPage from '@/app/siswa/latihan-bicara-ai/page'

const STATES: OrbState[] = ['idle', 'listening', 'thinking', 'speaking']

export default function DevPreviewPage() {
  const days = useMemo<ActivityDay[]>(() => {
    const out: ActivityDay[] = []
    const today = Date.parse('2026-11-14T00:00:00Z')
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today - i * 86_400_000).toISOString().slice(0, 10)
      const seed = (i * 37) % 11
      out.push({ date, count: seed > 6 ? (seed % 4) + 1 : 0 })
    }
    return out
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap items-start gap-4">
        {STATES.map((state) => (
          <div key={state} className="flex flex-col items-center gap-2 rounded-xl border border-rule bg-card p-3">
            <div className="h-56 w-56">
              <VoiceOrb state={state} getLevel={() => 0.55} />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{state}</span>
          </div>
        ))}
      </div>
      <ActivityHeatmap days={days} />
      <div className="border-t border-rule pt-6">
        <LatihanBicaraAIPage key="ai-tutor" />
      </div>
    </div>
  )
}
