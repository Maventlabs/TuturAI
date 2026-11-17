import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'

/**
 * Maps the quiz domain errors raised by `lib/quiz` onto HTTP responses.
 * Returns null for anything unexpected so the route can rethrow it.
 */
export function quizErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null

  switch (error.message) {
    case 'QUIZ_ATTEMPT_NOT_FOUND':
      return NextResponse.json(apiError('NOT_FOUND', 'Quiz attempt was not found'), { status: 404 })
    case 'QUIZ_ATTEMPT_FINISHED':
      return NextResponse.json(
        apiError('CONFLICT', 'Ujian ini sudah dikumpulkan', { code: 'QUIZ_ATTEMPT_FINISHED' }),
        { status: 409 },
      )
    case 'QUIZ_EXPIRED':
      return NextResponse.json(
        apiError('CONFLICT', 'Waktu ujian sudah habis', { code: 'QUIZ_EXPIRED' }),
        { status: 409 },
      )
    case 'QUIZ_QUESTION_NOT_IN_ATTEMPT':
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Soal ini bukan bagian dari ujian', { code: 'QUIZ_QUESTION_NOT_IN_ATTEMPT' }),
        { status: 400 },
      )
    case 'QUIZ_OPTION_OUT_OF_RANGE':
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Pilihan jawaban tidak valid', { code: 'QUIZ_OPTION_OUT_OF_RANGE' }),
        { status: 400 },
      )
    case 'QUIZ_BANK_INCOMPLETE':
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Bank soal untuk level ini belum lengkap', { code: 'QUIZ_BANK_INCOMPLETE' }),
        { status: 503 },
      )
    default:
      return null
  }
}
