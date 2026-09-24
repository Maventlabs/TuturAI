export type SkillKey =
  | 'pronunciation'
  | 'grammar'
  | 'vocabulary'
  | 'fluency'
  | 'confidence'
  | 'intonation'

export const SKILL_LABELS: Record<SkillKey, string> = {
  pronunciation: 'Pronunciation',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  fluency: 'Fluency',
  confidence: 'Confidence',
  intonation: 'Intonation',
}

export type Scores = Record<SkillKey, number>
