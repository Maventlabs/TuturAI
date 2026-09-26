import { NextRequest, NextResponse } from 'next/server'
import { validateQuestionAnswerInput, type LearningContentType, type QuestionLevel, type QuestionSkill } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { answerQuestion, listPublishedQuestions, listStudentMasteredQuestionIds } from '@/lib/question-bank'
import { readJsonBody } from '@/lib/api/request'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const params = request.nextUrl.searchParams
  const skill = params.get('skill') as QuestionSkill | null
  const level = params.get('level') as QuestionLevel | null
  const contentType = params.get('type') as LearningContentType | null
  const limit = Number(params.get('limit') ?? 10)
  const questions = await listPublishedQuestions({
    skill: skill && ['grammar', 'vocabulary', 'reading'].includes(skill) ? skill : undefined,
    level: level && ['beginner', 'intermediate', 'advanced'].includes(level) ? level : undefined,
    contentType: contentType && ['question', 'vocabulary', 'listening', 'pronunciation', 'speaking', 'conversation', 'test'].includes(contentType) ? contentType : undefined,
    limit: Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 20) : 10,
  })
  const masteredIds = await listStudentMasteredQuestionIds(auth.user.uid, questions.map((question) => question.id))

  return NextResponse.json({ data: questions, masteredIds })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const validation = validateQuestionAnswerInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid answer input', validation.issues), { status: 400 })
  }

  try {
    const result = await answerQuestion({ studentId: auth.user.uid, ...validation.data })
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof Error && error.message === 'QUESTION_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Question not found'), { status: 404 })
    }
    if (error instanceof Error && error.message === 'QUESTION_TYPE_NOT_ANSWERABLE') {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'This activity requires its dedicated assessment flow'), { status: 422 })
    }
    throw error
  }
}
