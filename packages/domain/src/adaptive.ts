import type { AssessmentDimensions } from './types'

export type AdaptiveDimension = keyof AssessmentDimensions
export type AdaptiveDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface AdaptiveActivity {
  id: string
  title: string
  dimension: AdaptiveDimension
  difficulty: AdaptiveDifficulty
}

export interface AdaptiveRecommendationInput {
  assessments: Array<Pick<AssessmentDimensions, AdaptiveDimension>>
  activities: AdaptiveActivity[]
  currentDifficulty: AdaptiveDifficulty
}

export interface AdaptiveRecommendation {
  activity: AdaptiveActivity | null
  focusDimension: AdaptiveDimension | null
  difficulty: AdaptiveDifficulty
  reason: string
}

const dimensions: AdaptiveDimension[] = ['pronunciation', 'fluency', 'intonation', 'grammar', 'vocabulary', 'overall']
const difficultyOrder: AdaptiveDifficulty[] = ['beginner', 'intermediate', 'advanced']

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function nextDifficulty(overall: number, current: AdaptiveDifficulty) {
  const index = difficultyOrder.indexOf(current)
  if (overall >= 85) return difficultyOrder[Math.min(index + 1, difficultyOrder.length - 1)]
  if (overall < 60) return difficultyOrder[Math.max(index - 1, 0)]
  return current
}

export function recommendAdaptiveActivity(input: AdaptiveRecommendationInput): AdaptiveRecommendation {
  if (!input.activities.length) {
    return { activity: null, focusDimension: null, difficulty: input.currentDifficulty, reason: 'Belum ada materi yang tersedia.' }
  }

  if (!input.assessments.length) {
    const activity = input.activities.find(({ difficulty }) => difficulty === input.currentDifficulty) ?? input.activities[0]
    return { activity, focusDimension: null, difficulty: input.currentDifficulty, reason: 'Mulai dari latihan dasar untuk membangun baseline.' }
  }

  const scores = Object.fromEntries(
    dimensions.map((dimension) => [dimension, average(input.assessments.map((assessment) => assessment[dimension]))]),
  ) as Record<AdaptiveDimension, number>
  const focusDimension = dimensions.slice(0, -1).reduce((weakest, dimension) => scores[dimension] < scores[weakest] ? dimension : weakest, dimensions[0])
  const difficulty = nextDifficulty(scores.overall, input.currentDifficulty)
  const activity = input.activities.find(({ dimension, difficulty: activityDifficulty }) => dimension === focusDimension && activityDifficulty === difficulty)
    ?? input.activities.find(({ dimension }) => dimension === focusDimension)
    ?? input.activities.find(({ difficulty: activityDifficulty }) => activityDifficulty === difficulty)
    ?? input.activities[0]

  return {
    activity,
    focusDimension,
    difficulty,
    reason: `Fokus pada ${focusDimension} dengan tingkat ${difficulty} berdasarkan skor rata-rata terbaru ${Math.round(scores[focusDimension])}.`,
  }
}
