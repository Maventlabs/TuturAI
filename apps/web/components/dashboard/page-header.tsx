import BlurText from '@/components/ui/blur-text'
import SplitText from '@/components/ui/split-text'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <SplitText
          as="h1"
          text={title}
          className="text-balance font-heading text-2xl font-extrabold tracking-tight text-foreground"
        />
        {description && (
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            <BlurText text={description} delay={0.08} />
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
