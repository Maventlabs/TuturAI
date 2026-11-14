import { Mic, BookOpen, Headphones, ClipboardList, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The physical TuturAI handheld, rebuilt in CSS to match the product photo:
 * landscape shell, red left grip, orange right grip, black bezel, navy TFT.
 * Shared by the hero (interactive) and the offline section (static) so both
 * show the exact same object. Every dimension steps up at `sm` so the screen
 * stays legible on a phone instead of collapsing into overlapping labels.
 */

const modes = [
  { icon: Mic, label: 'Speaking', sub: 'Practice & feedback', active: true },
  { icon: BookOpen, label: 'Vocabulary', sub: 'Words & meaning' },
  { icon: Headphones, label: 'Listening', sub: 'Listen & understand' },
  { icon: ClipboardList, label: 'Quiz', sub: 'Test knowledge' },
  { icon: Bot, label: 'AI Chat', sub: 'Chat & practice' },
]

const statusBar = ['Student', 'Level 12', '850 XP', '7 Day Streak']

function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('absolute h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/25', className)}
    />
  )
}

function Grill({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex w-7 flex-col gap-1 sm:w-10', className)}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 rounded-full bg-black/35" />
      ))}
    </div>
  )
}

export function DeviceConsole({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Shoulder bumpers */}
      <div aria-hidden className="absolute -top-2 left-6 h-4 w-16 rounded-t-lg bg-ink-deep sm:left-8 sm:w-24" />
      <div aria-hidden className="absolute -top-2 right-6 h-4 w-16 rounded-t-lg bg-ink-deep sm:right-8 sm:w-24" />

      <div className="relative grid grid-cols-[58px_1fr_58px] overflow-hidden rounded-lg border border-black/30 bg-ink-deep shadow-[0_40px_90px_-30px_rgba(0,0,0,0.55)] sm:grid-cols-[104px_1fr_104px]">
        {/* Left grip — red */}
        <div className="relative flex flex-col bg-[#c62f2f] px-1.5 py-4 sm:px-2.5 sm:py-5">
          <Screw className="left-1.5 top-1.5 sm:left-2 sm:top-2" />
          <Screw className="right-1.5 top-1.5 sm:right-2 sm:top-2" />
          <span aria-hidden className="mx-auto block h-1.5 w-7 rounded-lg bg-ink-deep sm:h-2 sm:w-10" />

          {/* D-Pad, five directions */}
          <div className="relative mx-auto mt-5 h-[52px] w-[52px] sm:mt-8 sm:h-[72px] sm:w-[72px]">
            <span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-md bg-ink-deep shadow-inner sm:h-6 sm:w-6" />
            <span className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 rounded-md bg-ink-deep shadow-inner sm:h-6 sm:w-6" />
            <span className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-md bg-ink-deep shadow-inner sm:h-6 sm:w-6" />
            <span className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-md bg-ink-deep shadow-inner sm:h-6 sm:w-6" />
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-md bg-ink-deep sm:h-6 sm:w-6" />
          </div>

          <Grill className="mx-auto mt-auto pt-6 sm:pt-8" />
        </div>

        {/* Center — black bezel + TFT */}
        <div className="flex flex-col bg-ink-deep px-0.5 py-1.5 sm:py-2">
          <div className="overflow-hidden rounded-lg bg-[#0b1e3a] ring-1 ring-white/15">
            <div className="flex items-center justify-between px-2 py-1 font-mono text-[7px] text-white/70 sm:px-3 sm:py-1.5 sm:text-[9px]">
              <span>10.30 AM</span>
              <span aria-hidden className="flex items-center gap-1 sm:gap-1.5">
                <span className="h-1.5 w-2.5 rounded-sm border border-white/60 sm:w-3" />
                <span className="h-1 w-1.5 rounded-sm bg-white/70 sm:w-2" />
              </span>
            </div>

            <div className="px-2 pb-1.5 pt-0.5 text-center sm:px-3 sm:pb-2 sm:pt-1">
              <p className="font-display text-sm font-semibold tracking-tight text-white sm:text-base">
                Tutur<span className="text-primary">AI</span>
              </p>
              <p className="text-[7px] text-white/60 sm:text-[9px]">AI Powered Adaptive Learning</p>
              <p className="mt-0.5 text-[8px] font-medium leading-tight text-white/85 sm:mt-1 sm:text-[10px]">
                Choose a mode to start your learning journey
              </p>
            </div>

            <div className="grid grid-cols-5 gap-1 px-1.5 pb-1.5 sm:gap-1.5 sm:px-2 sm:pb-2">
              {modes.map((m) => (
                <div
                  key={m.label}
                  className={cn(
                    'rounded-lg px-0.5 py-1.5 text-center text-white sm:px-1 sm:py-2',
                    m.active ? 'bg-primary' : 'bg-white/10',
                  )}
                >
                  <m.icon className="mx-auto h-3 w-3 sm:h-4 sm:w-4" />
                  <p className="mt-1 text-[7px] font-bold leading-none sm:text-[10px]">{m.label}</p>
                  <p className="mt-1 hidden text-[8px] leading-tight text-white/60 sm:block">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1 whitespace-nowrap px-2 py-1 font-mono text-[7px] text-white/70 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[9px]">
              {statusBar.map((s, i) => (
                <span key={s} className="flex items-center gap-1 sm:gap-1.5">
                  {i > 0 && (
                    <span aria-hidden className="text-white/30">
                      &bull;
                    </span>
                  )}
                  {s}
                </span>
              ))}
            </div>
          </div>

          <p className="py-1 text-center font-display text-[10px] font-semibold tracking-tight text-white sm:py-1.5 sm:text-xs">
            Tutur<span className="text-primary">AI</span>
          </p>

          <div aria-hidden className="mx-4 mb-0.5 flex gap-0.5 sm:mx-6">
            <span className="h-1 flex-1 rounded-full bg-primary" />
            <span className="h-1 flex-1 rounded-full bg-white/15" />
            <span className="h-1 flex-1 rounded-full bg-white/15" />
            <span className="h-1 flex-1 rounded-full bg-white/15" />
            <span className="h-1 flex-1 rounded-full bg-white/15" />
          </div>
        </div>

        {/* Right grip — orange */}
        <div className="relative flex flex-col bg-[#e0701c] px-1.5 py-4 sm:px-2.5 sm:py-5">
          <Screw className="left-1.5 top-1.5 sm:left-2 sm:top-2" />
          <Screw className="right-1.5 top-1.5 sm:right-2 sm:top-2" />
          <span aria-hidden className="mx-auto block h-1.5 w-7 rounded-lg bg-ink-deep sm:h-2 sm:w-10" />

          {/* Y / X / B / A diamond */}
          <div className="relative mx-auto mt-3 h-[52px] w-[52px] sm:mt-4 sm:h-[68px] sm:w-[68px]">
            <span className="absolute left-1/2 top-0 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-ink-deep text-[8px] font-bold text-white shadow sm:h-6 sm:w-6 sm:text-[10px]">
              Y
            </span>
            <span className="absolute left-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-ink-deep text-[8px] font-bold text-white shadow sm:h-6 sm:w-6 sm:text-[10px]">
              X
            </span>
            <span className="absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-ink-deep text-[8px] font-bold text-white shadow sm:h-6 sm:w-6 sm:text-[10px]">
              B
            </span>
            <span className="absolute bottom-0 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-ink-deep text-[8px] font-bold text-white shadow sm:h-6 sm:w-6 sm:text-[10px]">
              A
            </span>
          </div>

          {/* Analog stick */}
          <div className="relative mx-auto mt-3 h-10 w-10 rounded-full bg-black/25 ring-1 ring-black/30 sm:mt-5 sm:h-14 sm:w-14">
            <span className="absolute inset-2 rounded-full bg-ink-deep shadow-inner sm:inset-3" />
          </div>

          <Grill className="mx-auto mt-auto pt-4 sm:pt-5" />
        </div>
      </div>
    </div>
  )
}
