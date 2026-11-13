import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

export interface PracticeMode {
  index: string
  label: string
  href: string
  icon: LucideIcon
  meta: string
  desc: string
  action: string
  image: string
  imageAlt: string
}

/**
 * One entry in the practice index: a tall plate that holds a photograph, the
 * mode's number, and the reason to open it.
 *
 * The photograph sits in a blue duotone at rest so six unrelated images read as
 * one printed set; hovering (or focusing) restores full colour and lifts the
 * plate. The scrim is a real gradient rather than a flat overlay so the copy
 * keeps its contrast at every crop.
 */
export function PracticeCard({ mode }: { mode: PracticeMode }) {
  const Icon = mode.icon

  return (
    <Link
      href={mode.href}
      className="group relative isolate flex aspect-4/5 flex-col justify-between overflow-hidden rounded-sm bg-ink-deep p-5 outline-none ring-1 ring-ink-foreground/10 ring-inset transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:aspect-3/4"
    >
      <Image
        src={mode.image}
        alt={mode.imageAlt}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="-z-10 object-cover grayscale transition-[filter,transform] duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0 motion-reduce:transition-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-primary opacity-45 mix-blend-color transition-opacity duration-700 group-hover:opacity-0 motion-reduce:transition-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink-deep via-ink-deep/50 to-transparent"
      />
      {/* A short top scrim keeps the index and icon legible on pale photographs. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-28 bg-linear-to-b from-ink-deep/75 to-transparent"
      />

      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] leading-none tracking-[0.18em] text-ink-foreground/65">
          {mode.index}
        </span>
        <span className="flex size-8 items-center justify-center rounded-full border border-ink-foreground/25 text-ink-foreground/80 transition-colors duration-300 group-hover:border-ink-foreground/50 group-hover:bg-ink-foreground/10 group-hover:text-ink-foreground">
          <Icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
        </span>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-accent-glow">
          {mode.meta}
        </p>
        <h2 className="mt-2.5 text-balance font-display text-[1.55rem] leading-[1.08] tracking-[-0.01em] text-ink-foreground">
          {mode.label}
        </h2>
        <p className="mt-2 text-pretty text-[13px] leading-relaxed text-ink-foreground/70">
          {mode.desc}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-foreground/20 pt-3">
          <span className="text-[12px] font-semibold leading-none text-ink-foreground">
            {mode.action}
          </span>
          <ArrowUpRight
            className="size-4 shrink-0 text-ink-foreground/70 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-foreground motion-reduce:transition-none"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  )
}
