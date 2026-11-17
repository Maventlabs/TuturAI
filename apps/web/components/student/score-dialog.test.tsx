import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const asMotionElement = (tag: string) => {
    const MotionElement = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      function MotionElement({ children, ...props }, ref) {
        return React.createElement(tag, { ...props, ref }, children)
      },
    )
    MotionElement.displayName = `Motion(${tag})`
    return MotionElement
  }
  return {
    motion: { section: asMotionElement('section'), span: asMotionElement('span') },
    useReducedMotion: () => false,
  }
})

import { ScoreDialog } from './score-dialog'

describe('ScoreDialog', () => {
  it('shows the brand, the score and a high-score narrative', () => {
    const markup = renderToStaticMarkup(
      createElement(ScoreDialog, {
        open: true,
        eyebrow: 'Kuis kosakata selesai',
        score: 92,
        detail: '18 benar · 2 salah',
        onClose: vi.fn(),
      }),
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('Kuis kosakata selesai')
    expect(markup).toContain('Hebat!')
    expect(markup).toContain('92')
    expect(markup).toContain('18 benar · 2 salah')
    expect(markup).toContain('%2Fbrand%2Flogo-mark-blue.png')
  })

  it('encourages instead of scolding on a low score', () => {
    const markup = renderToStaticMarkup(
      createElement(ScoreDialog, {
        open: true,
        eyebrow: 'Latihan listening selesai',
        score: 24,
        onClose: vi.fn(),
      }),
    )

    expect(markup).toContain('Jangan berkecil hati')
  })

  it('renders nothing before the session has a result', () => {
    const markup = renderToStaticMarkup(
      createElement(ScoreDialog, { open: false, eyebrow: 'Kuis terpadu selesai', score: 10, onClose: vi.fn() }),
    )

    expect(markup).toBe('')
  })
})
