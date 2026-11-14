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
    motion: { section: asMotionElement('section'), div: asMotionElement('div') },
    useReducedMotion: () => false,
  }
})

import { CompletionDialog } from './completion-dialog'

const onClose = vi.fn()

describe('CompletionDialog', () => {
  it('renders the confirmed result with an accessible dialog and brand reaction', () => {
    const markup = renderToStaticMarkup(createElement(CompletionDialog, {
      open: true,
      title: 'Percakapan mantap!',
      message: 'Hasil sudah tersimpan.',
      score: '79.5/100',
      detail: 'Umpan balik tersedia.',
      reaction: 'speaking',
      onClose,
    }))

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('Percakapan mantap!')
    expect(markup).toContain('79.5/100')
    expect(markup).toContain('%2Fbrand%2Flogo-mark-blue.png')
    expect(markup).toContain('Tutup hasil')
  })

  it('does not render a result before the activity has completed', () => {
    const markup = renderToStaticMarkup(createElement(CompletionDialog, {
      open: false,
      title: 'Belum selesai',
      message: 'Menunggu hasil.',
      score: '0/100',
      onClose,
    }))

    expect(markup).toBe('')
  })
})
