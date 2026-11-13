import { cn } from '@/lib/utils'

export type StatusTone = 'ok' | 'idle' | 'warn' | 'error'

const TONE_STYLES: Record<StatusTone, string> = {
  ok: 'border-success/35 bg-success/10 text-success',
  idle: 'border-border bg-muted text-muted-foreground',
  warn: 'border-warning/35 bg-warning/10 text-warning',
  error: 'border-destructive/35 bg-destructive/10 text-destructive',
}

export function StatusChip({ tone = 'idle', children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]',
        TONE_STYLES[tone],
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  )
}

type ButtonTone = 'primary' | 'outline' | 'ghost'

export function sheetButtonClass(tone: ButtonTone = 'outline', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
    tone === 'primary' && 'bg-foreground text-background hover:opacity-85',
    tone === 'outline' && 'border border-border text-foreground hover:border-foreground/40 hover:bg-muted',
    tone === 'ghost' && 'text-muted-foreground hover:text-foreground',
    className,
  )
}

export function SheetButton({
  tone = 'outline',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return <button {...props} className={sheetButtonClass(tone, className)} />
}

export function SectionHeader({
  label,
  description,
  status,
}: {
  label: string
  description?: string
  status?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</h2>
        {description && (
          <p className="mt-1.5 max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {status}
    </div>
  )
}

export interface Field {
  label: string
  value: string | null
  hint?: string
}

export function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0 bg-card px-3.5 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{field.label}</dt>
          <dd
            className={cn(
              'mt-1 truncate text-[13px] leading-snug',
              field.value ? 'text-foreground' : 'text-muted-foreground/60',
            )}
            title={field.value ?? undefined}
          >
            {field.value || 'Belum tersedia'}
          </dd>
          {field.hint && (
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">{field.hint}</p>
          )}
        </div>
      ))}
    </dl>
  )
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-rule py-3.5 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        <p className="mt-0.5 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

export function SheetNote({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'mt-3 border-l-2 pl-2.5 text-[12px] leading-relaxed',
        tone === 'error' ? 'border-destructive/40 text-destructive' : 'border-rule text-muted-foreground',
      )}
    >
      {children}
    </p>
  )
}
