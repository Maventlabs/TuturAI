import { EmptyNote } from '@/components/guru/overview/panel'

const TICKS = [100, 75, 50, 25, 0]

interface AccuracyTrendProps {
  points: Array<{ label: string; score: number }>
  target?: number
}

export function AccuracyTrend({ points, target = 75 }: AccuracyTrendProps) {
  const hasData = points.length > 0
  const denominator = Math.max(points.length - 1, 1)
  const coords = points.map((point, index) => ({
    x: (index / denominator) * 100,
    y: 100 - Math.max(0, Math.min(100, point.score)),
  }))
  const line = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`).join(' ')
  const area = points.length > 1 ? `${line} L100,100 L0,100 Z` : ''
  const last = coords[coords.length - 1]

  return (
    <div>
      <p className="sr-only">
        {hasData
          ? `Tren akurasi kumulatif dari ${points.length} attempt terakhir: ${points
              .map((point) => `${point.label} ${point.score} persen`)
              .join(', ')}. Target ${target} persen.`
          : 'Belum ada attempt latihan terkonfirmasi.'}
      </p>
      <div className="relative ml-9 h-[190px] lg:h-[220px]" aria-hidden>
        {TICKS.map((tick) => (
          <div key={tick} className="absolute inset-x-0 border-t border-grid" style={{ top: `${100 - tick}%` }} />
        ))}
        <div
          className="absolute inset-x-0 border-t border-dashed border-warning/45"
          style={{ top: `${100 - target}%` }}
        />
        {TICKS.map((tick) => (
          <span
            key={`label-${tick}`}
            className="absolute -left-9 w-7 -translate-y-1/2 text-right font-mono text-[9px] tabular-nums text-muted-foreground/70"
            style={{ top: `${100 - tick}%` }}
          >
            {tick}
          </span>
        ))}

        {hasData ? (
          <>
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {area && <path d={area} fill="var(--primary)" fillOpacity={0.06} />}
              {points.length > 1 && (
                <path
                  d={line}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            <span
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
              style={{ left: `${last.x}%`, top: `${last.y}%` }}
              aria-hidden
            />
            <span
              className="absolute -translate-y-[calc(100%+10px)] whitespace-nowrap font-mono text-[10px] font-medium tabular-nums text-foreground"
              style={{ left: `${last.x}%`, top: `${last.y}%`, transform: `translate(-50%, calc(-100% - 10px))` }}
            >
              {points[points.length - 1].score}%
            </span>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyNote
              title="Belum ada attempt terkonfirmasi"
              description="Garis akurasi terbentuk setelah siswa menyelesaikan latihan kuis pertama."
            />
          </div>
        )}
      </div>

      <div className="ml-9 mt-2 flex justify-between">
        {(hasData ? points : Array.from({ length: 12 }, (_, index) => ({ label: `A${index + 1}`, score: 0 }))).map(
          (point, index) => (
            <span
              key={`${point.label}-${index}`}
              className="font-mono text-[9px] tabular-nums text-muted-foreground/60"
            >
              {point.label}
            </span>
          ),
        )}
      </div>

      <div className="ml-9 mt-3 flex items-center gap-4 border-t border-rule pt-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-[2px] w-4 bg-primary" aria-hidden />
          Akurasi kumulatif
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-0 w-4 border-t border-dashed border-warning/70" aria-hidden />
          Target {target}%
        </span>
      </div>
    </div>
  )
}
