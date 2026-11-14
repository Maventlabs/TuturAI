'use client'

import { useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface VoiceOrbProps {
  state: OrbState
  /**
   * Reads the live 0..1 energy of whichever audio source is active — the
   * microphone while listening, the spoken reply while speaking. Read inside
   * the animation frame so the orb never re-renders React at 60fps.
   */
  getLevel?: () => number
  className?: string
}

const CX = 120
const CY = 116
const BODY_W = 148
const BODY_H = 120
const BODY_R = 34
const FACE_W = 108
const FACE_H = 82
const FACE_R = 26

const BAR_X = [-18, -9, 0, 9, 18]
const BAR_REST = [8, 15, 22, 15, 8]
const BAR_SHAPE = [0.5, 0.8, 1, 0.8, 0.5]
const BAR_BOTTOM = CY + 30

const EYE_X = [-22, 22]
const EYE_Y = CY - 20
const EYE_W = 11
const EYE_H = 22

/**
 * A rounded square whose corners and edges breathe independently, so the mark
 * reads as a soft object rather than a rigid icon.
 */
function roundedSquare(
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
  wobble: number[],
  bulge: number,
) {
  const x0 = cx - w / 2
  const x1 = cx + w / 2
  const y0 = cy - h / 2
  const y1 = cy + h / 2
  const [r0, r1, r2, r3] = wobble
  const k = 0.45

  return [
    `M ${x0 + r * r0} ${y0}`,
    `Q ${cx} ${y0 - bulge} ${x1 - r * r1} ${y0}`,
    `C ${x1 - r * r1 * (1 - k)} ${y0} ${x1} ${y0 + r * r1 * (1 - k)} ${x1} ${y0 + r * r1}`,
    `Q ${x1 + bulge} ${cy} ${x1} ${y1 - r * r2}`,
    `C ${x1} ${y1 - r * r2 * (1 - k)} ${x1 - r * r2 * (1 - k)} ${y1} ${x1 - r * r2} ${y1}`,
    `Q ${cx} ${y1 + bulge} ${x0 + r * r3} ${y1}`,
    `C ${x0 + r * r3 * (1 - k)} ${y1} ${x0} ${y1 - r * r3 * (1 - k)} ${x0} ${y1 - r * r3}`,
    `Q ${x0 - bulge} ${cy} ${x0} ${y0 + r * r0}`,
    `C ${x0} ${y0 + r * r0 * (1 - k)} ${x0 + r * r0 * (1 - k)} ${y0} ${x0 + r * r0} ${y0}`,
    'Z',
  ].join(' ')
}

/** The two speech-bubble tails, drawn behind the body so the fills merge. */
function tailPaths() {
  const x0 = CX - BODY_W / 2
  const x1 = CX + BODY_W / 2
  const y0 = CY - BODY_H / 2
  const y1 = CY + BODY_H / 2

  return {
    top: [
      `M ${x1 - 60} ${y0 + 12}`,
      `C ${x1 - 38} ${y0 + 2} ${x1 - 14} ${y0 - 10} ${x1 + 6} ${y0 - 25}`,
      `C ${x1 + 8} ${y0 - 8} ${x1 + 4} ${y0 + 8} ${x1 - 4} ${y0 + 26}`,
      'Z',
    ].join(' '),
    bottom: [
      `M ${x0 + 50} ${y1 - 12}`,
      `C ${x0 + 30} ${y1 - 2} ${x0 + 8} ${y1 + 10} ${x0 - 13} ${y1 + 25}`,
      `C ${x0 - 9} ${y1 + 8} ${x0 - 3} ${y1 - 8} ${x0 + 6} ${y1 - 26}`,
      'Z',
    ].join(' '),
  }
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

export function VoiceOrb({ state, getLevel, className }: VoiceOrbProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const bodyRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const clipRef = useRef<SVGPathElement>(null)
  const faceRef = useRef<SVGPathElement>(null)
  const rootRef = useRef<SVGGElement>(null)
  const haloRef = useRef<SVGCircleElement>(null)
  const eyeRefs = useRef<Array<SVGRectElement | null>>([])
  const barRefs = useRef<Array<SVGRectElement | null>>([])
  const rippleRefs = useRef<Array<SVGCircleElement | null>>([])

  const levelRef = useRef(getLevel)
  useEffect(() => {
    levelRef.current = getLevel
  }, [getLevel])
  const smoothRef = useRef(0)

  const tails = tailPaths()
  const active = state === 'listening' || state === 'speaking'

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const paint = (energy: number, t: number, blink: number) => {
      const breath = Math.sin(t * 1.15) * 0.5 + 0.5
      const float = Math.sin(t * 0.9) * 2.2
      const scale = 1 + breath * 0.012 + energy * 0.05
      const tilt = Math.sin(t * 0.55) * 1.5

      const amp = 0.05 + energy * 0.16
      const wobble = [
        1 + Math.sin(t * 1.7) * amp,
        1 + Math.sin(t * 1.7 + 1.6) * amp,
        1 + Math.sin(t * 1.7 + 3.1) * amp,
        1 + Math.sin(t * 1.7 + 4.7) * amp,
      ]
      const bulge = 1.6 + energy * 3.4 + Math.sin(t * 1.3) * 0.7

      const body = roundedSquare(CX, CY, BODY_W, BODY_H, BODY_R, wobble, bulge)
      bodyRef.current?.setAttribute('d', body)
      glowRef.current?.setAttribute('d', body)
      clipRef.current?.setAttribute('d', body)
      faceRef.current?.setAttribute(
        'd',
        roundedSquare(
          CX,
          CY + 2,
          FACE_W,
          FACE_H,
          FACE_R,
          wobble.map((value) => 1 + (value - 1) * 0.5),
          bulge * 0.4,
        ),
      )

      rootRef.current?.setAttribute(
        'transform',
        `translate(${CX} ${CY + float}) scale(${scale}) rotate(${tilt}) translate(${-CX} ${-CY})`,
      )

      haloRef.current?.setAttribute('r', String(94 + energy * 26 + breath * 4))
      haloRef.current?.setAttribute('opacity', String(0.14 + energy * 0.3))
      glowRef.current?.setAttribute('opacity', String(0.18 + energy * 0.4))

      rippleRefs.current.forEach((ripple, index) => {
        if (!ripple) return
        if (state === 'thinking') {
          const phase = (t * 0.34 + index * 0.5) % 1
          ripple.setAttribute('r', String(80 + phase * 38))
          ripple.setAttribute('opacity', String((1 - phase) * 0.24))
          return
        }
        const phase = (t * 0.5 + index * 0.5) % 1
        ripple.setAttribute('r', String(72 + phase * 44))
        ripple.setAttribute(
          'opacity',
          state === 'speaking' ? String((1 - phase) * (0.1 + energy * 0.22)) : '0',
        )
      })

      const eyeHeight = EYE_H * (1 - blink * 0.92)
      for (const eye of eyeRefs.current) {
        if (!eye) continue
        eye.setAttribute('height', String(eyeHeight))
        eye.setAttribute('y', String(EYE_Y - eyeHeight / 2))
      }

      barRefs.current.forEach((bar, index) => {
        if (!bar) return
        const phase = Math.sin(t * 3.4 - index * 0.7) * 0.5 + 0.5
        const idle = state === 'idle' ? phase * 2.5 : 0
        const thinking = state === 'thinking' ? phase * 13 : 0
        const audio = energy * 28 * BAR_SHAPE[index]
        const height = BAR_REST[index] + idle + thinking + audio
        bar.setAttribute('height', String(height))
        bar.setAttribute('y', String(BAR_BOTTOM - height))
      })
    }

    if (reduceMotion) {
      paint(0, 0, 0)
      return
    }

    let raf = 0
    let blinkAt = performance.now() + 2400
    let blinkStart = -1000

    const frame = (now: number) => {
      const t = now / 1000
      const raw = active ? clamp01(levelRef.current?.() ?? 0) : 0
      const smooth = smoothRef.current
      smoothRef.current = smooth + (raw - smooth) * (raw > smooth ? 0.4 : 0.09)

      const energy = state === 'thinking' ? 0.34 + Math.sin(t * 2.2) * 0.1 : smoothRef.current

      if (now > blinkAt) {
        blinkStart = now
        blinkAt = now + 3200 + Math.random() * 2800
      }
      const blinkPhase = (now - blinkStart) / 170
      const blink = blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) : 0

      paint(energy, t, blink)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [state, active])

  return (
    <svg
      viewBox="0 0 240 240"
      role="presentation"
      aria-hidden="true"
      className={cn('h-full w-full overflow-visible', state === 'error' && 'opacity-60 saturate-50', className)}
    >
      <defs>
        <radialGradient id={`${uid}-body`} cx="0.34" cy="0.22" r="0.92">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--primary) 58%, white)" />
          <stop offset="42%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--primary) 68%, black)" />
        </radialGradient>

        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
          <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0%" stopColor="black" stopOpacity="0.18" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.22" />
        </linearGradient>

        <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>

        <clipPath id={`${uid}-clip`}>
          <path ref={clipRef} />
        </clipPath>
      </defs>

      <circle ref={haloRef} cx={CX} cy={CY} r="96" fill={`url(#${uid}-halo)`} opacity="0.16" />

      {[0, 1].map((index) => (
        <circle
          key={index}
          ref={(node) => {
            rippleRefs.current[index] = node
          }}
          cx={CX}
          cy={CY}
          r="72"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          opacity="0"
        />
      ))}

      <ellipse cx={CX} cy={CY + 80} rx="60" ry="11" fill={`url(#${uid}-shadow)`} />

      <g ref={rootRef}>
        <path ref={glowRef} fill="var(--primary)" opacity="0.2" filter={`url(#${uid}-glow)`} />

        <path d={tails.top} fill={`url(#${uid}-body)`} />
        <path d={tails.bottom} fill={`url(#${uid}-body)`} />
        <path ref={bodyRef} fill={`url(#${uid}-body)`} />

        <g clipPath={`url(#${uid}-clip)`}>
          <ellipse cx={CX} cy={CY + 74} rx="96" ry="44" fill="black" opacity="0.22" filter={`url(#${uid}-soft)`} />
          <ellipse cx={CX - 30} cy={CY - 40} rx="42" ry="26" fill="white" opacity="0.3" filter={`url(#${uid}-soft)`} />
        </g>

        <path ref={faceRef} fill="var(--card)" />

        {EYE_X.map((x, index) => (
          <rect
            key={x}
            ref={(node) => {
              eyeRefs.current[index] = node
            }}
            x={CX + x - EYE_W / 2}
            y={EYE_Y - EYE_H / 2}
            width={EYE_W}
            height={EYE_H}
            rx={EYE_W / 2}
            fill="var(--primary)"
          />
        ))}

        {BAR_X.map((x, index) => (
          <rect
            key={x}
            ref={(node) => {
              barRefs.current[index] = node
            }}
            x={CX + x - 3.5}
            y={BAR_BOTTOM - BAR_REST[index]}
            width="7"
            height={BAR_REST[index]}
            rx="3.5"
            fill="var(--primary)"
          />
        ))}

        <path
          d={roundedSquare(CX, CY, BODY_W, BODY_H, BODY_R, [1, 1, 1, 1], 0)}
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth="1.5"
        />
      </g>
    </svg>
  )
}
