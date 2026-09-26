import { describe, expect, it } from 'vitest'
import { DRIVE_MAX_FILE_BYTES, validateDriveFile } from './drive'

describe('validateDriveFile', () => {
  it('sanitizes an allowed assignment attachment', () => {
    expect(validateDriveFile({ name: 'worksheet/final.pdf', mimeType: 'application/pdf', size: 120 })).toEqual({
      name: 'worksheet_final.pdf',
      mimeType: 'application/pdf',
      size: 120,
    })
  })

  it.each([
    ['UNSUPPORTED_FILE_TYPE', { name: 'audio.mp3', mimeType: 'audio/mpeg', size: 120 }],
    ['INVALID_FILE_EXTENSION', { name: 'worksheet.txt', mimeType: 'application/pdf', size: 120 }],
    ['FILE_TOO_LARGE', { name: 'large.pdf', mimeType: 'application/pdf', size: DRIVE_MAX_FILE_BYTES + 1 }],
    ['INVALID_FILE_NAME', { name: '   ', mimeType: 'application/pdf', size: 120 }],
  ])('rejects %s', (error, input) => {
    expect(() => validateDriveFile(input)).toThrow(error)
  })
})
