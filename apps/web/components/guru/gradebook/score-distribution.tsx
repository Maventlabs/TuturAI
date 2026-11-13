import { cn } from '@/lib/utils'
import { TARGET_SCORE } from '@/lib/gradebook'

// The split sits exactly on the target score, so the two below-target bands
// read as one warning group and the two at-or-above bands as one passing group.
const BAND_TONE = ['bg-warning', 'bg-warning/70', 'bg-primary', 'bg-primary']

interface ScoreDistributionProps {
  distribution: Array<{ label: string; count: number }>
  classAverage: number | null
  gradedTotal: number
}

export function ScoreDistribution({ distribution, classAverage, gradedTotal }: ScoreDistributionProps) {
  const max = Math.max(...distribution.map((band) => band.count), 1)

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <ul className="space-y-3">
        {distribution.map((band, index) => {
          const share = gradedTotal > 0 ? Math.round((band.count / gradedTotal) * 100) : 0
          return (
            <li key={band.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {band.label}
              </span>
              <span className="relative h-4 flex-1 bg-secondary/50">
                <span
                  className={cn('absolute inset-y-0 left-0', BAND_TONE[index])}
                  style={{ width: `${(band.count / max) * 100}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
                {band.count}
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground/60">
                {share}%
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex items-baseline justify-between gap-3 border-t border-rule pt-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Rata-rata kelas
        </span>
        <span className="font-mono text-[15px] font-medium tabular-nums text-foreground">
          {classAverage === null ? '–' : classAverage.toFixed(1)}
          <span className="ml-1.5 text-[9px] font-normal uppercase tracking-[0.1em] text-muted-foreground/60">
            target {TARGET_SCORE}
          </span>
        </span>
      </div>
    </div>
  )
}
