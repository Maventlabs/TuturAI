import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  showText = true,
  textClassName = 'font-heading',
}: {
  className?: string
  showText?: boolean
  textClassName?: string
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Image
        src="/brand/logo-mark-blue.png"
        alt="Logo TuturAI"
        width={36}
        height={38}
        className="h-9 w-auto shrink-0"
        priority
      />
      {showText && (
        <span className={cn('text-lg font-extrabold tracking-tight text-foreground', textClassName)}>
          Tutur<span className="text-primary">AI</span>
        </span>
      )}
    </span>
  )
}
