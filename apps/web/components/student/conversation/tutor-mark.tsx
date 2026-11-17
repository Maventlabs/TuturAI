import { cn } from '@/lib/utils'

const BARS = [7, 12, 16, 12, 7]

/** Static version of the tutor face, used where a live orb would be noise. */
export function TutorMark({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground',
        size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10',
        className,
      )}
    >
      <span className="flex items-end gap-[2.5px]">
        {BARS.map((height, index) => (
          <span
            key={index}
            className="w-[2.5px] rounded-full bg-current"
            style={{ height: size === 'sm' ? height * 0.7 : height }}
          />
        ))}
      </span>
    </span>
  )
}
