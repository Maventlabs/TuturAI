import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'

/**
 * Maps the reading domain errors raised by `lib/reading` onto HTTP responses.
 * Returns null for anything unexpected so the route can rethrow it.
 */
export function readingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null

  switch (error.message) {
    case 'READING_ATTEMPT_NOT_FOUND':
      return NextResponse.json(apiError('NOT_FOUND', 'Sesi reading tidak ditemukan'), { status: 404 })
    case 'READING_ATTEMPT_FINISHED':
      return NextResponse.json(
        apiError('CONFLICT', 'Sesi reading ini sudah dikumpulkan', { code: 'READING_ATTEMPT_FINISHED' }),
        { status: 409 },
      )
    case 'READING_QUESTION_NOT_IN_ATTEMPT':
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Soal ini bukan bagian dari sesi reading', { code: 'READING_QUESTION_NOT_IN_ATTEMPT' }),
        { status: 400 },
      )
    case 'READING_OPTION_OUT_OF_RANGE':
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Pilihan jawaban tidak valid', { code: 'READING_OPTION_OUT_OF_RANGE' }),
        { status: 400 },
      )
    case 'READING_BANK_INCOMPLETE':
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Bank passage untuk level ini belum lengkap', { code: 'READING_BANK_INCOMPLETE' }),
        { status: 503 },
      )
    default:
      return null
  }
}
