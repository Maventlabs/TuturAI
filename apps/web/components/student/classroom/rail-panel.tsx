export function RailPanel({
  label,
  meta,
  children,
}: {
  label: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </h2>
        {meta && <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">{meta}</span>}
      </header>
      <div className="flex-1 px-4 py-4">{children}</div>
    </section>
  )
}
