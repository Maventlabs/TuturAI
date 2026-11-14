'use client'

import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/dist/SplitText'

gsap.registerPlugin(SplitText)

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

const INTRO_EASE = 'cubic-bezier(0.25,1,0.5,1)'
const IMAGE_ENTRY_Y_PERCENT = 500
const TEXT_ROTATE_X_START = 90
const TEXT_TRANSFORM_PERSPECTIVE = 1000
const IMAGE_Z_INDEX_DURATION = 0.1
const IMAGE_Z_INDEX_STAGGER = 0.2
const TEXT_STAGGER = 0.08
const STACK_SCALE_STEP = 0.15
const STACK_Y_PERCENT_STEP = 20
const SPREAD_Y_PERCENT_STEP = 110
const IMAGE_FADE_STAGGER = 0.08

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, numericValue))
}

export interface StackLoaderProps {
  /** Card artwork, bottom of the stack first. */
  images: string[]
  leftText: string
  rightText: string
  caption: string
  id?: string
  ariaLabel?: string
  imageSize?: number
  duration?: number
  fadeOutDuration?: number
  backgroundColor?: string
  onComplete?: () => void
}

export function StackLoader({
  images,
  leftText,
  rightText,
  caption,
  id = 'stack-loader',
  ariaLabel = 'Memuat',
  imageSize = 1,
  duration = 1,
  fadeOutDuration = 0.8,
  backgroundColor = 'var(--color-background)',
  onComplete,
}: StackLoaderProps) {
  const uid = useId().replace(/:/g, '')
  const imgsWrapperId = `imgs-wrapper-${uid}`
  const rootRef = useRef<HTMLElement | null>(null)
  const imagesRef = useRef<(HTMLDivElement | null)[]>([])
  const text1Ref = useRef<HTMLParagraphElement | null>(null)
  const text2Ref = useRef<HTMLParagraphElement | null>(null)
  const descriptionTextRef = useRef<HTMLParagraphElement | null>(null)
  const onCompleteRef = useRef(onComplete)
  const safeImageSize = clampNumber(imageSize, 0.5, 2.5, 1)
  const safeDuration = clampNumber(duration, 0.25, 3, 1)
  const safeFadeOutDuration = clampNumber(fadeOutDuration, 0.1, 3, 0.8)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useIsomorphicLayoutEffect(() => {
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false

    // Reduced motion: cards are already laid out in a column, so only fade.
    if (reduceMotion) {
      const ctx = gsap.context(() => {
        const imageElements = imagesRef.current.filter(Boolean)
        const sideText = [text1Ref.current, text2Ref.current].filter(Boolean)
        const description = descriptionTextRef.current
        const totalImages = imageElements.length
        const totalSpread =
          totalImages > 1 ? SPREAD_Y_PERCENT_STEP * (totalImages - 1) : 0

        gsap.set(`#${imgsWrapperId}`, { yPercent: 0, opacity: 1 })
        gsap.set(imageElements, {
          opacity: 0,
          scale: 1,
          zIndex: (index: number) => index,
          yPercent: (index: number) =>
            totalImages === 1
              ? 0
              : -totalSpread / 2 + index * SPREAD_Y_PERCENT_STEP,
        })
        gsap.set(sideText, { opacity: 0, rotateX: 0 })
        if (description) gsap.set(description, { opacity: 0, rotateX: 0 })

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          onComplete: () => {
            gsap.set(rootRef.current, { display: 'none' })
            onCompleteRef.current?.()
          },
        })
        tl.timeScale(1 / safeDuration)

        tl.to(imageElements, {
          opacity: 1,
          duration: 0.7,
          stagger: { each: 0.06, from: 'center' },
        })

        tl.to(sideText, { opacity: 1, duration: 0.55 }, '-=0.35')
        if (description) {
          tl.to(description, { opacity: 1, duration: 0.55 }, '<')
        }

        tl.to(
          [...sideText, description].filter(Boolean),
          { opacity: 0, duration: 0.5 },
          '+=0.55',
        )
        tl.to(
          imageElements,
          {
            opacity: 0,
            duration: safeFadeOutDuration,
            stagger: { each: 0.04, from: 'edges' },
          },
          '-=0.15',
        )
        tl.to(rootRef.current, { opacity: 0, duration: safeFadeOutDuration }, '-=0.2')
      }, rootRef)

      return () => ctx.revert()
    }

    const ctx = gsap.context(() => {
      const imageElements = imagesRef.current.filter(Boolean)

      const text1 = SplitText.create(text1Ref.current, { type: 'words' })
      const text2 = SplitText.create(text2Ref.current, { type: 'words' })
      const descriptionText = SplitText.create(descriptionTextRef.current, {
        type: 'words,lines',
      })

      const animatedTextTargets = [text1.words, text2.words, descriptionText.lines]

      gsap.set(animatedTextTargets, {
        rotateX: TEXT_ROTATE_X_START,
        opacity: 0,
        transformPerspective: TEXT_TRANSFORM_PERSPECTIVE,
        transformOrigin: '50% 100%',
        willChange: 'transform',
      })

      gsap.set(imageElements, { opacity: 0 })
      gsap.set(descriptionTextRef.current, { opacity: 1 })

      const tl = gsap.timeline()
      tl.timeScale(1 / safeDuration)

      tl.fromTo(
        `#${imgsWrapperId}`,
        { yPercent: IMAGE_ENTRY_Y_PERCENT, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: INTRO_EASE },
      )

      tl.set([text1Ref.current, text2Ref.current], { opacity: 1 }, '<')

      tl.to(
        imageElements,
        { opacity: 1, duration: 0.5, ease: INTRO_EASE },
        '<',
      )

      tl.to(
        animatedTextTargets,
        { rotateX: 0, opacity: 1, stagger: TEXT_STAGGER, ease: INTRO_EASE },
        '<+0.5',
      )

      imageElements.forEach((imageElement, index) => {
        tl.to(
          imageElement,
          { zIndex: index, duration: IMAGE_Z_INDEX_DURATION, ease: INTRO_EASE },
          index * IMAGE_Z_INDEX_STAGGER,
        )
      })

      tl.to(
        imageElements,
        {
          scale: (index: number) => 1 + index * STACK_SCALE_STEP,
          yPercent: (index: number) => -(index * STACK_Y_PERCENT_STEP),
          duration: 1,
          stagger: { each: 0.01, from: 'end' },
          ease: 'power3.inOut',
        },
        '<',
      )

      tl.to(
        imageElements,
        {
          scale: 1,
          yPercent: (index: number, _target: unknown, elements: unknown[]) => {
            const totalImages = elements.length

            if (totalImages === 1) return 0

            const totalSpread = SPREAD_Y_PERCENT_STEP * (totalImages - 1)

            return -totalSpread / 2 + index * SPREAD_Y_PERCENT_STEP
          },
          duration: 1,
          stagger: { each: 0.01, from: 'end' },
          ease: 'power3.inOut',
        },
        '+=0.2',
      )

      tl.to(
        descriptionText.lines,
        {
          rotateX: TEXT_ROTATE_X_START,
          transformOrigin: 'top center',
          opacity: 0,
          duration: 1,
          stagger: TEXT_STAGGER,
          ease: INTRO_EASE,
        },
        '<-0.1',
      )

      tl.to(`#${imgsWrapperId}`, { yPercent: 0, ease: INTRO_EASE }, '<')

      tl.to([text1.words, text2.words], {
        opacity: 0,
        duration: 0.5,
        rotateX: TEXT_ROTATE_X_START,
        transformOrigin: 'top center',
        stagger: TEXT_STAGGER,
        ease: INTRO_EASE,
      })

      tl.to(
        imageElements,
        {
          opacity: 0,
          duration: safeFadeOutDuration,
          stagger: { each: IMAGE_FADE_STAGGER, from: 'end' },
          onComplete: () => {
            gsap.to(rootRef.current, {
              opacity: 0,
              duration: safeFadeOutDuration,
              ease: INTRO_EASE,
              onComplete: () => {
                gsap.set(rootRef.current, { display: 'none' })
                onCompleteRef.current?.()
              },
            })
          },
        },
        '<+0.2',
      )

      return () => {
        text1.revert()
        text2.revert()
        descriptionText.revert()
      }
    }, rootRef)

    return () => ctx.revert()
  }, [imgsWrapperId, safeDuration, safeFadeOutDuration, images])

  return (
    <section
      ref={rootRef}
      id={id}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[9999] flex h-dvh w-full items-center justify-center overflow-hidden px-[2.5vw] text-foreground max-[1025px]:px-[5vw] max-md:px-[6vw]"
      style={{ backgroundColor }}
    >
      <div className="flex w-full items-center justify-between max-[1025px]:flex-col max-[1025px]:justify-center max-[1025px]:gap-[33vh] max-md:gap-[50vw]">
        <p
          ref={text1Ref}
          className="font-heading text-xs font-semibold uppercase tracking-[0.3em] opacity-0 max-[1025px]:text-[2.8vw] max-md:text-[5vw]"
        >
          {leftText}
        </p>

        <div
          id={imgsWrapperId}
          data-loader-stack
          className="relative aspect-[4/3] max-[1025px]:z-[99]"
          style={{ width: `clamp(6rem, ${11 * safeImageSize}vw, 13rem)` }}
        >
          {images.map((src, index) => (
            <div
              key={`${src}-${index}`}
              ref={(element) => {
                imagesRef.current[index] = element
              }}
              className="absolute top-0 left-0 size-full overflow-hidden rounded-xl opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the splash must paint from pre-sized static WebP, not wait on an optimizer round-trip */}
              <img
                src={src}
                width={480}
                height={360}
                className="h-full w-full object-cover"
                alt=""
                decoding="async"
              />
            </div>
          ))}
        </div>

        <p
          ref={text2Ref}
          className="font-heading text-xs font-semibold uppercase tracking-[0.3em] opacity-0 max-[1025px]:text-[2.8vw] max-md:text-[4vw]"
        >
          {rightText}
        </p>
      </div>

      <p
        ref={descriptionTextRef}
        data-loader-caption
        className="absolute bottom-[3vw] left-1/2 w-[40vw] -translate-x-1/2 text-center font-heading text-sm leading-[1.4] text-muted-foreground opacity-0 max-[1025px]:w-[68vw] max-md:bottom-[6vw] max-md:w-[90%]"
      >
        {caption}
      </p>
    </section>
  )
}
