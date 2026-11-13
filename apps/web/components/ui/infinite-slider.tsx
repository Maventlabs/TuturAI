import { cn } from '@/lib/utils'

/**
 * Vertically auto-scrolling loop. The children are rendered twice and the
 * track translates by -50%, so the loop is seamless as long as every child
 * carries its own trailing spacing (e.g. `pb-6` on each card).
 */
export function InfiniteSlider({
  children,
  speed = 40,
  reverse = false,
  className,
}: {
  children: React.ReactNode
  /** Duration of one full loop in seconds. Higher = slower. */
  speed?: number
  reverse?: boolean
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden', className)}>
      <div
        className="flex flex-col animate-infinite-scroll"
        style={{
          animationDuration: `${speed}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {children}
        <div aria-hidden="true" className="contents">
          {children}
        </div>
      </div>
    </div>
  )
}
