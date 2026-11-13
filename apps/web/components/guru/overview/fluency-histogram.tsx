import { cn } from '@/lib/utils'

interface FluencyHistogramProps {
  buckets: Array<{ label: string; count: number }>
}

export function FluencyHistogram({ buckets }: FluencyHistogramProps) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1)
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)

  return (
    <div>
      <div className="flex h-[132px] items-end gap-2 border-b border-rule">
        {buckets.map((bucket, index) => {
          const height = bucket.count === 0 ? 2 : Math.max(6, (bucket.count / max) * 100)
          return (
            <div key={bucket.label} className="flex h-full flex-1 flex-col justify-end">
              <div className="relative w-full" style={{ height: `${height}%` }}>
                <span className="absolute inset-x-0 -top-4 text-center font-mono text-[11px] tabular-nums text-foreground">
                  {bucket.count}
                </span>
                <div className={cn('h-full w-full', index === 0 ? 'bg-warning/70' : 'bg-primary')} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {buckets.map((bucket) => (
          <span
            key={bucket.label}
            className="flex-1 text-center font-mono text-[9px] tabular-nums text-muted-foreground"
          >
            {bucket.label}
          </span>
        ))}
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
        {total} sesi dinilai
      </p>
    </div>
  )
}
