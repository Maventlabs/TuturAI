import { calculateOverallScore, type Assessment, type AssessmentMode, type NormalizedAssessment } from '@tuturai/domain'
import type { AssessmentProviderRequest } from './assessment-provider'

export interface AssessmentProviderLike {
  assess(request: AssessmentProviderRequest): Promise<NormalizedAssessment>
}

export type SaveAssessment = (assessment: Assessment) => Promise<Assessment>

export interface ProcessAssessmentInput {
  provider: AssessmentProviderLike
  save: SaveAssessment
  studentId: string
  sessionId: string
  questionId?: string
  request: AssessmentProviderRequest
  mode?: AssessmentMode
  now?: Date
}

export async function processAssessment(input: ProcessAssessmentInput): Promise<Assessment> {
  const result = await input.provider.assess(input.request)
  const mode = input.mode ?? input.request.mode ?? 'speaking'
  const assessment: Assessment = {
    id: `${input.studentId}_${input.sessionId}`,
    sessionId: input.sessionId,
    ...(input.questionId ? { questionId: input.questionId } : {}),
    studentId: input.studentId,
    ...result,
    mode,
    overall: calculateOverallScore(mode, result),
    error: null,
    createdAt: (input.now ?? new Date()).toISOString(),
  }

  return input.save(assessment)
}
