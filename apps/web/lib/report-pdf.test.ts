import { describe, expect, it } from 'vitest'
import { createReportPdf } from './report-pdf'

describe('createReportPdf', () => {
  it('creates a valid single-page PDF without leaking non-ASCII text', () => {
    const pdf = createReportPdf(['TuturAI Report', 'Siswa: Budi (XI IPA)', 'Akurasi: 80%'])
    const text = pdf.toString('ascii')

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('%%EOF')
    expect(text).toContain('TuturAI Report')
    expect(text).toContain('Siswa: Budi \\(XI IPA\\)')
  })
})
