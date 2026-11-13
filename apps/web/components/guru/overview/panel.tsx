import { cn } from '@/lib/utils'

interface PanelProps {
  label: string
  meta?: string
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

export function Panel({ label, meta, action, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cn('flex min-w-0 flex-col bg-card', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </h2>
        {action ?? (meta ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">{meta}</span>
        ) : null)}
      </header>
      <div className={cn('flex-1 px-4 py-4', bodyClassName)}>{children}</div>
    </section>
  )
}

interface EmptyNoteProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyNote({ title, description, action }: EmptyNoteProps) {
  return (
    <div className="border-l-2 border-primary/25 pl-3">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/70">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-[36ch] text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  )
}
