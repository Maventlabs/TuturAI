'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const items = [
  'XP mingguan',
  'Speaking session',
  'Leaderboard kelas',
  'Streak harian',
  'Kurikulum Merdeka',
  'Offline mode',
  'Feedback 5 dimensi',
  'Voice guru',
]

export function ProofMarquee() {
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !trackRef.current) return
    const ctx = gsap.context(() => {
      gsap.to(trackRef.current, {
        xPercent: -50,
        ease: 'none',
        duration: 26,
        repeat: -1,
      })
    }, trackRef)
    return () => ctx.revert()
  }, [])

  return (
    <section aria-label="Hari ini di TuturAI" className="overflow-hidden border-y border-border bg-card py-5">
      <div ref={trackRef} className="flex w-max items-center gap-10 pr-10">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-sm font-semibold text-foreground">{item}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
          </span>
        ))}
      </div>
    </section>
  )
}
