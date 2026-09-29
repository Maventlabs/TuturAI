'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

export interface ScoreTrendPoint {
  week: string
  skor: number
}

/**
 * Score trend chart, split out of the progress page so recharts (~336 KB) is
 * downloaded only when trend data actually exists (PERF-001 code splitting).
 */
export function ScoreTrendChart({ trend }: { trend: ScoreTrendPoint[] }) {
  return (
    <ChartContainer config={{ skor: { label: 'Skor', color: 'var(--chart-1)' } }} className="h-[280px] w-full">
      <AreaChart data={trend} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="monotone" dataKey="skor" stroke="var(--color-skor)" fill="var(--color-skor)" fillOpacity={0.15} strokeWidth={2.5} />
      </AreaChart>
    </ChartContainer>
  )
}
