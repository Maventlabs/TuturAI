'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const topics = ['Perkenalan diri', 'Wawancara kerja', 'Presentasi kelas', 'Cerita liburan']

const steps = [
  {
    n: '01',
    title: 'Pilih topik',
    desc: 'Ambil skenario harian, materi sekolah, atau latihan ujian. Satu ketuk, sesi langsung mulai.',
    visual: (
      <div className="flex flex-wrap gap-2">
        {topics.map((t, i) => (
          <span
            key={t}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              i === 0 ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: '02',
    title: 'Bicara dengan AI',
    desc: 'Tekan mikrofon dan mulai bicara. AI merespons natural dalam bahasa Inggris, tanpa menghakimi.',
    visual: (
          <div className="rounded-sm border border-border bg-secondary p-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Merekam
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">0:42</span>
        </div>
        <div className="mt-3 flex h-10 items-end gap-1" aria-hidden>
          {[40, 70, 55, 90, 65, 80, 50, 95, 60, 75, 45, 85, 58, 72].map((h, i) => (
            <span key={i} className="w-1.5 rounded-lg bg-primary" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    n: '03',
    title: 'Dapat feedback dan XP',
    desc: 'Skor lima dimensi, koreksi grammar, dan XP yang menambah progres levelmu.',
    visual: (
      <div className="space-y-2.5">
        {[
          { label: 'Pronunciation', value: 86 },
          { label: 'Fluency', value: 78 },
          { label: 'Grammar', value: 82 },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{r.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-lg bg-secondary">
              <span className="block h-full rounded-lg bg-primary" style={{ width: `${r.value}%` }} />
            </span>
            <span className="w-6 font-mono text-[11px] font-semibold text-foreground">{r.value}</span>
          </div>
        ))}
        <p className="pt-1 font-mono text-[11px] text-muted-foreground">+40 XP · Level 12</p>
      </div>
    ),
  },
]

const STACK_TOP = 96
const STACK_STEP = 16

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.how-card')
        const pairs = cards.slice(0, -1).map((card, i) => ({ card, next: cards[i + 1] }))

        // Sticky elements make ScrollTrigger's start/end strings unreliable, so
        // the recess is derived from the cards' real positions: 0 when the next
        // card touches this card's bottom edge, 1 when it reaches its top.
        const update = () => {
          pairs.forEach(({ card, next }) => {
            const rect = card.getBoundingClientRect()
            const p = gsap.utils.clamp(0, 1, (rect.bottom - next.getBoundingClientRect().top) / rect.height)
            gsap.set(card, { scale: 1 - 0.06 * p, opacity: 1 - 0.4 * p })
          })
        }

        const trigger = ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: update,
          onRefresh: update,
        })
        update()

        return () => trigger.kill()
      })
      return () => mm.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      id="cara-kerja"
      className="scroll-mt-24 bg-secondary/50 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-medium leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
            Tiga langkah, lalu kamu bicara.
          </h2>
          <p className="mt-5 text-muted-foreground text-pretty">
            Urutannya sengaja sederhana supaya siswa bisa mulai sendiri tanpa dijelaskan dulu.
          </p>
        </div>

        {/* CSS sticky rather than ScrollTrigger pinning: later cards paint above
            earlier ones by DOM order, so the stack never shows through. */}
        <div className="mt-12">
          {steps.map((s, i) => (
            <article
              key={s.n}
              className="how-card sticky mb-6 grid gap-8 rounded-sm border border-border bg-card p-7 shadow-[0_8px_40px_-24px_rgba(29,29,31,0.28)] sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
              style={{ top: `${STACK_TOP + i * STACK_STEP}px`, zIndex: i + 1 }}
            >
              <div>
                <span className="font-mono text-sm font-semibold text-primary">{s.n}</span>
                <h3 className="mt-3 font-display text-2xl font-medium tracking-[-0.01em] text-foreground sm:text-3xl">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-[52ch] leading-relaxed text-muted-foreground text-pretty">
                  {s.desc}
                </p>
              </div>
              <div>{s.visual}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
