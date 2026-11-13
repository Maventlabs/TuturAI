import { cn } from '@/lib/utils'
import { TARGET_SCORE, type DimensionSummary } from '@/lib/gradebook'

const AXES = 5
const CENTER = 100
const RADIUS = 72
const RINGS = [0.25, 0.5, 0.75, 1]
const LABEL_ANCHOR = ['middle', 'start', 'start', 'end', 'end'] as const

function vertex(index: number, ratio: number) {
  const angle = (Math.PI * 2 * index) / AXES - Math.PI / 2
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio,
  }
}

function ring(ratio: number) {
  return Array.from({ length: AXES }, (_, index) => {
    const point = vertex(index, ratio)
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
  }).join(' ')
}

interface DimensionRadarProps {
  dimensions: DimensionSummary[]
}

export function DimensionRadar({ dimensions }: DimensionRadarProps) {
  const measured = dimensions.filter((dimension) => dimension.value !== null)
  const profile = dimensions
    .map((dimension, index) => {
      const point = vertex(index, (dimension.value ?? 0) / 100)
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div className="flex h-full items-center gap-5">
      <svg
        viewBox="0 0 200 200"
        width={204}
        height={204}
        role="img"
        aria-label={
          measured.length > 0
            ? `Profil dimensi speaking: ${measured.map((d) => `${d.label} ${d.value}`).join(', ')}`
            : 'Profil dimensi speaking belum tersedia'
        }
        className="shrink-0 overflow-visible"
      >
        {RINGS.map((ratio) => (
          <polygon key={ratio} points={ring(ratio)} fill="none" stroke="var(--rule)" strokeWidth={0.7} />
        ))}

        <polygon
          points={ring(TARGET_SCORE / 100)}
          fill="none"
          stroke="var(--warning)"
          strokeOpacity={0.55}
          strokeWidth={0.9}
          strokeDasharray="3 3"
        />

        {Array.from({ length: AXES }).map((_, index) => {
          const point = vertex(index, 1)
          return (
            <line
              key={index}
              x1={CENTER}
              y1={CENTER}
              x2={point.x}
              y2={point.y}
              stroke="var(--rule)"
              strokeWidth={0.7}
            />
          )
        })}

        {measured.length > 0 && (
          <>
            <polygon points={profile} fill="var(--primary)" fillOpacity={0.16} stroke="var(--primary)" strokeWidth={1.5} />
            {dimensions.map((dimension, index) => {
              if (dimension.value === null) return null
              const point = vertex(index, dimension.value / 100)
              return <circle key={dimension.key} cx={point.x} cy={point.y} r={2.2} fill="var(--primary)" />
            })}
          </>
        )}

        {dimensions.map((dimension, index) => {
          const point = vertex(index, 1.17)
          return (
            <text
              key={dimension.key}
              x={point.x}
              y={point.y}
              textAnchor={LABEL_ANCHOR[index]}
              dominantBaseline="middle"
              fontSize={8}
              letterSpacing="0.08em"
              fill={dimension.value === null ? 'var(--muted-foreground)' : 'var(--muted-foreground)'}
              fillOpacity={dimension.value === null ? 0.4 : 1}
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              {dimension.short}
            </text>
          )
        })}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {dimensions.map((dimension) => (
          <li
            key={dimension.key}
            className="flex items-baseline justify-between gap-2 border-b border-rule/50 pb-1.5 last:border-b-0 last:pb-0"
          >
            <span className="truncate text-[11px] text-muted-foreground">{dimension.label}</span>
            <span
              className={cn(
                'shrink-0 font-mono text-[11px] tabular-nums',
                dimension.value === null
                  ? 'text-muted-foreground/40'
                  : dimension.value < TARGET_SCORE
                    ? 'text-warning'
                    : 'text-foreground',
              )}
            >
              {dimension.value === null ? 'n/a' : dimension.value.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
