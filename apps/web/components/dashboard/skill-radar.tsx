'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { SKILL_LABELS, type Scores, type SkillKey } from '@/lib/skills'

interface SkillRadarProps {
  scores: Scores
  compare?: Scores
  primaryLabel?: string
  compareLabel?: string
  className?: string
}

export function SkillRadar({
  scores,
  compare,
  primaryLabel = 'Skor',
  compareLabel = 'Pembanding',
  className,
}: SkillRadarProps) {
  const data = (Object.keys(SKILL_LABELS) as SkillKey[]).map((k) => ({
    skill: SKILL_LABELS[k],
    utama: scores[k],
    ...(compare ? { banding: compare[k] } : {}),
  }))

  const config: ChartConfig = {
    utama: { label: primaryLabel, color: 'var(--chart-1)' },
    banding: { label: compareLabel, color: 'var(--chart-2)' },
  }

  return (
    <ChartContainer config={config} className={className ?? 'mx-auto aspect-square max-h-[280px]'}>
      <RadarChart data={data}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarGrid />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
        <Radar
          dataKey="utama"
          fill="var(--color-utama)"
          fillOpacity={0.5}
          stroke="var(--color-utama)"
          strokeWidth={2}
        />
        {compare && (
          <Radar
            dataKey="banding"
            fill="var(--color-banding)"
            fillOpacity={0.15}
            stroke="var(--color-banding)"
            strokeWidth={2}
          />
        )}
      </RadarChart>
    </ChartContainer>
  )
}
