import { cn } from '@/lib/utils'

export type AnalyticsPeriod = '7d' | '30d' | 'all'

const OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: '7d', label: '7H' },
  { value: '30d', label: '30H' },
  { value: 'all', label: 'Semua' },
]

interface PeriodSwitchProps {
  value: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
}

export function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  return (
    <div role="group" aria-label="Rentang waktu analitik" className="flex items-center gap-px bg-rule">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
            value === option.value
              ? 'bg-foreground text-background'
              : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
