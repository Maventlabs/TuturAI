'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Mic, BookOpen, Headphones, ClipboardList, Bot } from 'lucide-react'

export function Device3D() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const rotRef = useRef({ y: -18, x: 6 })

  useEffect(() => {
    const scene = sceneRef.current
    const device = deviceRef.current
    if (!scene || !device) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        device,
        { opacity: 0, y: 36, rotationY: -30, rotationX: 10, scale: 0.97 },
        { opacity: 1, y: 0, rotationY: -18, rotationX: 6, scale: 1, duration: 0.9, ease: 'power3.out', delay: 0.2 },
      )
      gsap.to(device, { y: -8, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })

      // Cursor-driven 360 tilt: hover area follows pointer, drag spins freely
      let dragging = false
      let lastX = 0
      let velY = 0
      let raf: number | null = null

      const inertiaLoop = () => {
        rotRef.current.y += velY
        velY *= 0.95
        gsap.set(device, { rotationY: rotRef.current.y })
        if (Math.abs(velY) > 0.1) raf = requestAnimationFrame(inertiaLoop)
        else raf = null
      }

      const onMove = (e: PointerEvent) => {
        if (dragging) {
          const dx = e.clientX - lastX
          lastX = e.clientX
          velY = dx * 0.35
          rotRef.current.y += velY
          gsap.set(device, { rotationY: rotRef.current.y })
          return
        }
        const r = scene.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        rotRef.current.y = px * 34
        rotRef.current.x = 6 - py * 14
        gsap.to(device, { rotationY: rotRef.current.y, rotationX: rotRef.current.x, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
      }
      const onDown = (e: PointerEvent) => {
        dragging = true
        lastX = e.clientX
        if (raf) cancelAnimationFrame(raf)
        scene.setPointerCapture(e.pointerId)
      }
      const onUp = () => {
        dragging = false
        if (raf) cancelAnimationFrame(raf)
        raf = requestAnimationFrame(inertiaLoop)
      }
      const onLeave = () => {
        if (!dragging) gsap.to(device, { rotationY: -18, rotationX: 6, duration: 0.7, ease: 'power2.out', overwrite: 'auto' })
      }

      scene.addEventListener('pointermove', onMove)
      scene.addEventListener('pointerdown', onDown)
      scene.addEventListener('pointerup', onUp)
      scene.addEventListener('pointercancel', onUp)
      scene.addEventListener('pointerleave', onLeave)
      return () => {
        scene.removeEventListener('pointermove', onMove)
        scene.removeEventListener('pointerdown', onDown)
        scene.removeEventListener('pointerup', onUp)
        scene.removeEventListener('pointercancel', onUp)
        scene.removeEventListener('pointerleave', onLeave)
        if (raf) cancelAnimationFrame(raf)
      }
    }, sceneRef)
    return () => ctx.revert()
  }, [])

  const modes = [
    { icon: Mic, label: 'Speaking', sub: 'Practice & feedback', tone: 'bg-[#1d3a5f]' },
    { icon: BookOpen, label: 'Vocabulary', sub: 'Words & meaning', tone: 'bg-[#14532d]' },
    { icon: Headphones, label: 'Listening', sub: 'Listen & understand', tone: 'bg-[#3b0764]' },
    { icon: ClipboardList, label: 'Quiz', sub: 'Test knowledge', tone: 'bg-[#713f12]' },
    { icon: Bot, label: 'AI Chat', sub: 'Chat & practice', tone: 'bg-[#0c4a6e]' },
  ]

  return (
    <div ref={sceneRef} className="relative w-full cursor-grab [perspective:1400px] active:cursor-grabbing" aria-label="Konsol genggam TuturAI — gerakkan kursor atau geser untuk memutar 360 derajat">
      <div aria-hidden className="absolute inset-x-12 bottom-4 h-12 rounded-[100%] bg-black/35 blur-2xl" />

      <div
        ref={deviceRef}
        className="relative will-change-transform [transform-style:preserve-3d]"
        style={{ transform: 'rotateY(-18deg) rotateX(6deg)' }}
      >
        {/* Shoulder bumpers */}
        <div aria-hidden className="absolute -top-2 left-8 h-4 w-24 rounded-t-lg bg-[#101014]" />
        <div aria-hidden className="absolute -top-2 right-8 h-4 w-24 rounded-t-lg bg-[#101014]" />

        <div className="relative grid grid-cols-[86px_1fr_86px] rounded-lg border border-black/25 bg-[#101014] shadow-[0_48px_100px_-24px_rgba(0,0,0,0.6)] sm:grid-cols-[104px_1fr_104px]">
          {/* Left grip — red */}
          <div className="relative rounded-l-lg bg-[#c62f2f] px-2.5 py-5">
            <span aria-hidden className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/25" />
            <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/25" />
            <span className="mx-auto block h-2 w-10 rounded-lg bg-[#101014]" aria-hidden />
            {/* D-Pad */}
            <div className="relative mx-auto mt-8 h-[72px] w-[72px]">
              <div className="absolute left-1/2 top-0 h-6 w-6 -translate-x-1/2 rounded-md bg-[#101014] shadow-inner" />
              <div className="absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 rounded-md bg-[#101014] shadow-inner" />
              <div className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md bg-[#101014] shadow-inner" />
              <div className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md bg-[#101014] shadow-inner" />
              <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#101014]" />
            </div>
            {/* speaker grill */}
            <div className="mx-auto mt-8 flex w-10 flex-col gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="h-1 rounded-full bg-black/35" />)}
            </div>
          </div>

          {/* Center — black bezel + TFT */}
          <div className="flex flex-col bg-[#101014] px-0.5 py-2">
            <div className="overflow-hidden rounded-lg bg-[#0b1e3a] ring-1 ring-white/15">
              {/* status bar */}
              <div className="flex items-center justify-between px-3 py-1.5 font-mono text-[9px] text-white/70">
                <span>10.30 AM</span>
                <span className="flex items-center gap-1.5" aria-hidden>
                  <span className="h-1.5 w-3 rounded-sm border border-white/60" />
                  <span className="h-1 w-2 rounded-sm bg-white/70" />
                </span>
              </div>
              <div className="px-3 pb-2 pt-1 text-center">
                <p className="font-heading text-base font-extrabold tracking-tight text-white">
                  Tutur<span className="text-[#5b8cff]">AI</span>
                </p>
                <p className="text-[9px] text-white/60">AI Powered Adaptive Learning</p>
                <p className="mt-1 text-[10px] font-medium text-white/85">Choose a mode to start your learning journey</p>
              </div>
              {/* mode cards */}
              <div className="grid grid-cols-5 gap-1.5 px-2 pb-2">
                {modes.map((m) => (
                  <div key={m.label} className={`rounded-lg ${m.tone} px-1 py-2 text-center text-white`}>
                    <m.icon className="mx-auto h-4 w-4" />
                    <p className="mt-1 text-[10px] font-bold leading-none">{m.label}</p>
                    <p className="mt-1 hidden text-[8px] leading-tight text-white/60 sm:block">{m.sub}</p>
                  </div>
                ))}
              </div>
              {/* bottom info bar */}
              <div className="flex items-center justify-between px-3 py-1.5 text-[9px] text-white/70">
                <span>Student</span>
                <span>Level 12</span>
                <span>850 XP</span>
                <span>7 Day Streak</span>
              </div>
            </div>
            {/* bezel wordmark */}
            <p className="py-1.5 text-center font-heading text-xs font-extrabold tracking-tight text-white">
              Tutur<span className="text-[#5b8cff]">AI</span>
            </p>
            {/* LED strip */}
            <div className="mx-6 mb-0.5 flex gap-0.5" aria-hidden>
              <span className="h-1 flex-1 rounded-full bg-[#f2565c]" />
              <span className="h-1 flex-1 rounded-full bg-[#f5b445]" />
              <span className="h-1 flex-1 rounded-full bg-[#3fbd7f]" />
              <span className="h-1 flex-1 rounded-full bg-[#5b8cff]" />
              <span className="h-1 flex-1 rounded-full bg-[#8f7df5]" />
            </div>
          </div>

          {/* Right grip — orange */}
          <div className="relative rounded-r-lg bg-[#e0701c] px-2.5 py-5">
            <span aria-hidden className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/25" />
            <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black/40 ring-1 ring-white/25" />
            <span className="mx-auto block h-2 w-10 rounded-lg bg-[#101014]" aria-hidden />
            <div className="mt-4 grid grid-cols-2 justify-items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white shadow">Y</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white shadow">X</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white shadow">B</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#101014] text-[10px] font-bold text-white shadow">A</span>
            </div>
            <div className="relative mx-auto mt-5 h-14 w-14 rounded-full bg-black/25 ring-1 ring-black/30">
              <div className="absolute inset-3 rounded-full bg-[#101014] shadow-inner" />
            </div>
            <div className="mx-auto mt-5 flex w-10 flex-col gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="h-1 rounded-full bg-black/35" />)}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Gerakkan kursor / geser — putar 360°
      </p>
    </div>
  )
}
