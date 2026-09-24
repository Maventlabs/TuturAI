import type { AssessmentDimensions } from './types'

export type AssessmentMode = 'speaking' | 'pronunciation' | 'conversation'

type ScoreWeights = Pick<AssessmentDimensions, 'pronunciation' | 'fluency' | 'intonation' | 'grammar' | 'vocabulary'>

const WEIGHTS: Record<AssessmentMode, ScoreWeights> = {
  speaking: { pronunciation: 0.25, fluency: 0.2, intonation: 0.15, grammar: 0.2, vocabulary: 0.2 },
  pronunciation: { pronunciation: 0.7, fluency: 0.05, intonation: 0.1, grammar: 0.05, vocabulary: 0.1 },
  conversation: { pronunciation: 0.1, fluency: 0.25, intonation: 0.15, grammar: 0.25, vocabulary: 0.25 },
}

export function calculateOverallScore(mode: AssessmentMode, scores: ScoreWeights) {
  const weights = WEIGHTS[mode]
  return Math.round(
    scores.pronunciation * weights.pronunciation
      + scores.fluency * weights.fluency
      + scores.intonation * weights.intonation
      + scores.grammar * weights.grammar
      + scores.vocabulary * weights.vocabulary,
  )
}
