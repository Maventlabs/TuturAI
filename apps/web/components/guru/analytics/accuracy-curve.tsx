'use client'

import { useState } from 'react'
import { EmptyNote } from '@/components/guru/overview/panel'
import { cn } from '@/lib/utils'

const TICKS = [100, 75, 50, 25, 0]

interface AccuracyCurveProps {
  points: Array<{ label: string; score: number }>
  target?: number
}

export function AccuracyCurve({ points, target = 75 }: AccuracyCurveProps) {
  const [active, setActive] = useState<number | null>(null)
  const hasData = points.length > 0
  const denominator = Math.max(points.length - 1, 1)
  const coords = points.map((point, index) => ({
    x: (index / denominator) * 100,
    y: 100 - Math.max(0, Math.min(100, point.score)),
  }))
  const line = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
    .join(' ')
  const area = points.length > 1 ? `${line} L100,100 L0,100 Z` : ''
  const latest = points[points.length - 1]
  const delta = hasData ? latest.score - points[0].score : 0
  const activePoint = active === null ? null : points[active]
  const activeCoord = active === null ? null : coords[active]
  const flipTooltip = activeCoord !== null && activeCoord.y < 28

  return (
    <div className="flex h-full flex-col justify-between">
      <p className="sr-only">
        {hasData
          ? `Kurva akurasi kumulatif dari ${points.length} attempt terakhir: ${points
              .map((point) => `${point.label} ${point.score} persen`)
              .join(', ')}. Target ${target} persen.`
          : 'Belum ada attempt latihan terkonfirmasi pada rentang ini.'}
      </p>

      <div className="relative ml-9 mt-9 h-[196px] lg:h-[232px]">
        {TICKS.map((tick) => (
          <div key={tick} className="absolute inset-x-0 border-t border-grid" style={{ top: `${100 - tick}%` }} />
        ))}
        <div
          className="absolute inset-x-0 border-t border-dashed border-warning/50"
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
              {area && <path d={area} fill="var(--primary)" fillOpacity={0.07} />}
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

            {coords.map((coord, index) => (
              <span
                key={`dot-${points[index].label}-${index}`}
                className={cn(
                  'absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card transition-transform duration-150',
                  active === index && 'scale-[1.9]',
                )}
                style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                aria-hidden
              />
            ))}

            {activePoint && activeCoord && (
              <div
                className="pointer-events-none absolute z-10 whitespace-nowrap border border-rule bg-card px-2 py-1"
                style={{
                  left: `${activeCoord.x}%`,
                  top: `${activeCoord.y}%`,
                  transform: flipTooltip
                    ? 'translate(-50%, 14px)'
                    : 'translate(-50%, calc(-100% - 14px))',
                }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  {activePoint.label}
                </p>
                <p className="font-mono text-[12px] tabular-nums text-foreground">{activePoint.score}%</p>
              </div>
            )}

            <div className="absolute inset-0 flex">
              {points.map((point, index) => (
                <button
                  key={`hit-${point.label}-${index}`}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  aria-label={`${point.label}: akurasi ${point.score} persen`}
                  className="h-full flex-1 cursor-crosshair border-0 bg-transparent p-0 outline-none focus-visible:bg-primary/5"
                />
              ))}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyNote
              title="Belum ada attempt terkonfirmasi"
              description="Kurva terbentuk setelah siswa menyelesaikan latihan kuis pertama pada rentang ini."
            />
          </div>
        )}
      </div>

      <div className="ml-9 mt-2 flex justify-between">
        {(hasData ? points : Array.from({ length: 12 }, (_, index) => ({ label: `A${index + 1}`, score: 0 }))).map(
          (point, index) => (
            <span
              key={`x-${point.label}-${index}`}
              className="font-mono text-[9px] tabular-nums text-muted-foreground/60"
            >
              {point.label}
            </span>
          ),
        )}
      </div>

      <div className="ml-9 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rule pt-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-[2px] w-4 bg-primary" aria-hidden />
          Akurasi kumulatif
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="h-0 w-4 border-t border-dashed border-warning/70" aria-hidden />
          Target {target}%
        </span>
        {hasData && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            Δ{' '}
            <span className={cn('tabular-nums', delta < 0 ? 'text-warning' : 'text-foreground')}>
              {delta > 0 ? `+${delta}` : delta}
            </span>{' '}
            dari attempt pertama
          </span>
        )}
      </div>
    </div>
  )
}
