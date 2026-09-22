export type QuestionSkill = 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'pronunciation' | 'speaking'
export type QuestionLevel = 'beginner' | 'intermediate' | 'advanced'
export type LearningContentType =
  | 'question'
  | 'vocabulary'
  | 'listening'
  | 'pronunciation'
  | 'speaking'
  | 'conversation'
  | 'test'

export interface QuestionBankItem {
  id: string
  contentType: LearningContentType
  skill: QuestionSkill
  level: QuestionLevel
  prompt: string
  options: string[]
  explanation: string
  tags: string[]
  word?: string
  meaning?: string
  example?: string
  ipa?: string
  tip?: string
  audioText?: string
}

export interface QuestionAnswerInput {
  questionId: string
  selectedOption: number
  attemptId: string
}

export function validateQuestionAnswerInput(input: unknown):
  | { success: true; data: QuestionAnswerInput }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Answer payload is required' }] }
  }

  const value = input as Record<string, unknown>
  const issues: Array<{ path: string; message: string }> = []
  const questionId = typeof value.questionId === 'string' ? value.questionId.trim() : ''
  const attemptId = typeof value.attemptId === 'string' ? value.attemptId.trim() : ''
  const selectedOption = value.selectedOption

  if (!questionId || questionId.length > 128) issues.push({ path: 'questionId', message: 'Question id is required' })
  if (!attemptId || attemptId.length > 128) issues.push({ path: 'attemptId', message: 'Attempt id is required' })
  if (!Number.isInteger(selectedOption) || (selectedOption as number) < 0 || (selectedOption as number) > 20) {
    issues.push({ path: 'selectedOption', message: 'Selected option must be an integer from 0-20' })
  }

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { questionId, attemptId, selectedOption: selectedOption as number } }
}
