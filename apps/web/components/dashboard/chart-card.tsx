import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold text-foreground">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  )
}
