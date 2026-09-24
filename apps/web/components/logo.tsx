import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
        <Image
          src="/logo_tuturai.svg"
          alt="Logo TuturAI"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
          priority
        />
      </span>
      {showText && (
        <span className="font-heading text-lg font-extrabold tracking-tight text-foreground">
          Tutur<span className="text-primary">AI</span>
        </span>
      )}
    </span>
  )
}
