import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/dashboard/animated-number'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: number | string
  suffix?: string
  decimals?: number
  icon: LucideIcon
  delta?: number
  deltaLabel?: string
  tone?: 'primary' | 'accent' | 'success' | 'brand' | 'destructive'
}

const toneMap: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/15 text-success',
  brand: 'bg-brand/20 text-brand-foreground',
  destructive: 'bg-destructive/10 text-destructive',
}

export function KpiCard({
  label,
  value,
  suffix,
  decimals,
  icon: Icon,
  delta,
  deltaLabel,
  tone = 'primary',
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            toneMap[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              positive
                ? 'bg-success/15 text-success'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div>
        <p className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
          {typeof value === 'number' ? <AnimatedNumber value={value} suffix={suffix} decimals={decimals} /> : value}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        {deltaLabel && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{deltaLabel}</p>
        )}
      </div>
    </Card>
  )
}
