'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MousePointerClick, Mic, LineChart } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const steps = [
  {
    icon: MousePointerClick,
    n: '01',
    title: 'Pilih Topik',
    desc: 'Skenario sehari-hari, materi sekolah, atau latihan ujian. Satu tap, langsung mulai.',
  },
  {
    icon: Mic,
    n: '02',
    title: 'Bicara dengan AI',
    desc: 'Tekan mikrofon dan ngobrol. AI merespons natural dalam Bahasa Inggris.',
  },
  {
    icon: LineChart,
    n: '03',
    title: 'Dapat Feedback & XP',
    desc: 'Skor pronunciation, koreksi grammar, kumpulkan XP untuk naik level.',
  },
]

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !stackRef.current) return
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.how-card')
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return
        ScrollTrigger.create({
          trigger: card,
          start: 'top top',
          end: 'bottom top',
          pin: true,
          pinSpacing: false,
        })
        gsap.to(card, {
          scale: 0.94,
          opacity: 0.6,
          ease: 'none',
          scrollTrigger: {
            trigger: cards[i + 1],
            start: 'top bottom',
            end: 'top top',
            scrub: true,
          },
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="cara-kerja" className="scroll-mt-20 bg-secondary/40 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Tiga langkah. Langsung bicara.
          </h2>
          <p className="mt-4 text-muted-foreground">Scroll — kartu langkah menumpuk, kuncinya urutan belajarnya jelas.</p>
        </div>

        <div ref={stackRef} className="mt-12 space-y-6">
          {steps.map((s, i) => (
            <article
              key={s.n}
              className="how-card sticky top-24 flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-border bg-card p-7 shadow-[0_8px_40px_-16px_rgba(29,29,31,0.18)] sm:min-h-[320px] sm:p-10"
              style={{ top: `${96 + i * 14}px` }}
            >
              <div className="flex items-start justify-between gap-6">
                <span className="font-mono text-5xl font-bold text-primary/15 sm:text-7xl">{s.n}</span>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <s.icon className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{s.title}</h3>
                <p className="mt-2 max-w-[58ch] text-muted-foreground">{s.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
