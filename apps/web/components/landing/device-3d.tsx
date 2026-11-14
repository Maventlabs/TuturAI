'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { DeviceConsole } from './device-console'

const REST_Y = -18
const REST_X = 6

/**
 * Cursor-driven rotation: the console follows the pointer across the scene
 * (rotationY ±30°, rotationX ±12°) and can be grabbed and spun with inertia.
 * Transform-only, and fully static under prefers-reduced-motion.
 */
export function Device3D() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const rot = useRef({ y: REST_Y, x: REST_X })

  useEffect(() => {
    const scene = sceneRef.current
    const float = floatRef.current
    const device = deviceRef.current
    if (!scene || !float || !device) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        device,
        { opacity: 0, rotationY: -34, rotationX: 12, scale: 0.96 },
        {
          opacity: 1,
          rotationY: REST_Y,
          rotationX: REST_X,
          scale: 1,
          duration: 0.9,
          ease: 'power3.out',
          delay: 0.15,
        },
      )
      gsap.to(float, { y: -8, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })

      let dragging = false
      let lastX = 0
      let velY = 0
      let raf: number | null = null

      const spin = () => {
        rot.current.y += velY
        velY *= 0.94
        gsap.set(device, { rotationY: rot.current.y })
        raf = Math.abs(velY) > 0.08 ? requestAnimationFrame(spin) : null
      }

      const onMove = (e: PointerEvent) => {
        if (dragging) {
          const dx = e.clientX - lastX
          lastX = e.clientX
          velY = dx * 0.4
          rot.current.y += velY
          gsap.set(device, { rotationY: rot.current.y })
          return
        }
        const r = scene.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        rot.current.y = px * 60
        rot.current.x = REST_X - py * 24
        gsap.to(device, {
          rotationY: rot.current.y,
          rotationX: rot.current.x,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      }

      const onDown = (e: PointerEvent) => {
        dragging = true
        lastX = e.clientX
        if (raf) cancelAnimationFrame(raf)
        raf = null
        scene.setPointerCapture(e.pointerId)
      }

      const onUp = () => {
        if (!dragging) return
        dragging = false
        if (raf) cancelAnimationFrame(raf)
        raf = requestAnimationFrame(spin)
      }

      const onLeave = () => {
        if (dragging) return
        gsap.to(device, {
          rotationY: REST_Y,
          rotationX: REST_X,
          duration: 0.7,
          ease: 'power2.out',
          overwrite: 'auto',
        })
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

  return (
    <div
      ref={sceneRef}
      className="relative w-full cursor-grab touch-pan-y [perspective:1400px] active:cursor-grabbing"
      role="img"
      aria-label="Konsol genggam TuturAI. Gerakkan kursor atau geser untuk memutar perangkat."
    >
      <div ref={floatRef} className="[transform-style:preserve-3d]">
        <div
          ref={deviceRef}
          className="will-change-transform [transform-style:preserve-3d]"
          style={{ transform: `rotateY(${REST_Y}deg) rotateX(${REST_X}deg)` }}
        >
          <DeviceConsole />
        </div>
      </div>

      <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Gerakkan kursor atau geser untuk memutar
      </p>
    </div>
  )
}
